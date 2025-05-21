from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, url_for, flash, session
import os
import yaml
import tempfile
import shutil
import json
from pathlib import Path
from werkzeug.utils import secure_filename
from datetime import datetime
from update_product_images import process_file_to_sql, load_config
import glob
import zipfile
import io

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['OUTPUT_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
app.config['CONFIG_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config')
app.secret_key = 'your-secret-key-here'

# 確保上傳和輸出目錄存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(app.config['CONFIG_FOLDER'], exist_ok=True)

# 允許的檔案副檔名
ALLOWED_EXTENSIONS = {'tsv', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_sample_data(filepath, limit=5):
    """讀取檔案的前幾行作為預覽"""
    import csv
    
    # 判斷檔案類型
    is_tsv = filepath.lower().endswith('.tsv')
    delimiter = '\t' if is_tsv else ','
    
    data = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter=delimiter)
        headers = next(reader)
        
        # 讀取前幾行數據
        for i, row in enumerate(reader):
            if i >= limit:
                break
            data.append(dict(zip(headers, row)))
    
    return headers, data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # 清空上傳目錄
        shutil.rmtree(app.config['UPLOAD_FOLDER'], ignore_errors=True)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # 儲存檔案
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # 讀取範例數據
        try:
            headers, data = get_sample_data(filepath)
            return jsonify({
                'success': True,
                'filename': filename,
                'headers': headers,
                'data': data
            })
        except Exception as e:
            return jsonify({'error': f'Error reading file: {str(e)}'}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/generate_sql', methods=['POST'])
def generate_sql():
    app.logger.info(f"Entered /generate_sql route. Request headers: {request.headers}")
    app.logger.info(f"Request is JSON: {request.is_json}")
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
            
        data = request.json
        app.logger.info(f'Received generate request with data: {data}')
        
        # 檢查必要的欄位
        if 'filename' not in data:
            return jsonify({'error': 'Missing required field: filename'}), 400
            
        filename = data['filename']
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # 檢查檔案是否存在
        if not os.path.exists(filepath):
            return jsonify({'error': f'File not found: {filename}'}), 404
        
        # 建立臨時設定檔
        config = {
            'database': {
                'name': data.get('db_name', 'mms'),
                'table': data.get('table_name', 'PRODUCT_IMAGES')
            },
            'batch': {
                'size': int(data.get('batch_size', 10000))
            },
            'input': {
                'file': filepath,
                'format': 'tsv' if filename.lower().endswith('.tsv') else 'csv',
                'has_header': data.get('has_header', True)
            },
            'output': {
                'dir': app.config['OUTPUT_FOLDER']
            },
            'identifiers': [
                {
                    'name': id_field.get('db_column', ''),
                    'column': id_field.get('file_column', ''),
                    'data_type': id_field.get('data_type', '').lower(),
                    'is_numeric': id_field.get('data_type', '').lower() == 'number' or bool(id_field.get('is_numeric', False))
                }
                for id_field in data.get('identifiers', [])
                if 'db_column' in id_field and 'file_column' in id_field
            ],
            'update_columns': [
                {
                    'name': col.get('db_column', ''),
                    'column': col.get('file_column', ''),
                    'data_type': col.get('data_type', '').lower(),
                    'is_numeric': col.get('data_type', '').lower() == 'number' or bool(col.get('is_numeric', False))
                }
                for col in data.get('update_columns', [])
                if 'db_column' in col and 'file_column' in col
            ],
            'static_values': data.get('static_values', {}) or {}
        }
        
        # 驗證必要欄位
        if not config['identifiers']:
            return jsonify({'error': 'At least one identifier is required'}), 400
            
        if not config['update_columns'] and not config['static_values']:
            return jsonify({'error': 'At least one update column or static value is required'}), 400
        
        # 儲存設定檔
        config_path = os.path.join(app.config['CONFIG_FOLDER'], 'temp_config.yaml')
        
        def str_to_bool(value):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ('true', '1', 'yes')
            return bool(value)
            
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, sort_keys=False)
        
        # 載入設定檔
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            
        # 確保 is_numeric 是布林值
        for section in ['identifiers', 'update_columns']:
            for item in config.get(section, []):
                if 'is_numeric' in item:
                    item['is_numeric'] = str_to_bool(item['is_numeric'])
        
        # 清空輸出目錄
        shutil.rmtree(app.config['OUTPUT_FOLDER'], ignore_errors=True)
        os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
        
        app.logger.info(f"Calling process_file_to_sql with config: {json.dumps(config, indent=2, ensure_ascii=False)}")
        # 生成 SQL 並獲取處理結果
        result = process_file_to_sql(
            input_file=config['input']['file'],
            config=config,
            output_dir=config['output']['dir'],
            batch_size=config['batch']['size']
        )
        
        # 獲取生成的 SQL 檔案
        output_files = sorted([f for f in os.listdir(app.config['OUTPUT_FOLDER']) 
                             if f.endswith('.sql')])
        
        if not output_files:
            return jsonify({'error': 'No SQL files were generated. Please check your input file and configuration.'}), 400
        
        # 儲存處理的資料筆數到 session
        session['processed_rows'] = result.get('row_count', 0)
        
        return jsonify({
            'success': True,
            'output_files': output_files,
            'processed_rows': result.get('row_count', 0)
        })
        
    except Exception as e:
        app.logger.error(f'Error in generate_sql: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': f'An error occurred while generating SQL: {str(e)}',
            'type': type(e).__name__
        }), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(
        app.config['OUTPUT_FOLDER'],
        filename,
        as_attachment=True
    )

@app.route('/preview/<filename>')
def preview_file(filename):
    filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return content

@app.route('/download_all')
def download_all():
    # 創建內存中的ZIP文件
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        for root, dirs, files in os.walk(app.config['OUTPUT_FOLDER']):
            for file in files:
                if file.endswith('.sql'):
                    file_path = os.path.join(root, file)
                    zf.write(file_path, os.path.basename(file_path))
    
    memory_file.seek(0)
    return send_from_directory(
        directory=app.config['OUTPUT_FOLDER'],
        path=memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name='sql_statements.zip'
    )

@app.route('/configure')
def configure():
    # 檢查是否有上傳的檔案
    upload_dir = app.config['UPLOAD_FOLDER']
    files = os.listdir(upload_dir)
    
    if not files:
        flash('請先上傳檔案', 'error')
        return redirect(url_for('index'))
    
    # 讀取檔案標頭
    filename = files[0]
    filepath = os.path.join(upload_dir, filename)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            # 讀取第一行作為標題行
            first_line = f.readline().strip()
            headers = first_line.split('\t' if filename.lower().endswith('.tsv') else ',')
            
            # 讀取前幾行數據用於預覽
            preview_data = []
            for _ in range(5):  # 最多讀取5行
                line = f.readline()
                if not line:
                    break
                preview_data.append(line.strip().split('\t' if filename.lower().endswith('.tsv') else ','))
            
            return render_template(
                'configure.html',
                filename=filename,
                headers=headers,
                preview_data=preview_data
            )
    except Exception as e:
        flash(f'讀取檔案時發生錯誤: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/result')
def result():
    # 獲取生成的SQL文件列表
    output_files = []
    
    # 從 session 中獲取處理的資料筆數
    total_rows = session.get('processed_rows', 0)
    
    # 獲取檔案大小和行數（僅用於顯示）
    for file in os.listdir(app.config['OUTPUT_FOLDER']):
        if file.endswith('.sql'):
            filepath = os.path.join(app.config['OUTPUT_FOLDER'], file)
            size = os.path.getsize(filepath)
            
            # 計算檔案行數（僅用於參考）
            with open(filepath, 'r', encoding='utf-8') as f:
                line_count = sum(1 for _ in f)
                
            output_files.append({
                'name': file,
                'size': size,
                'rows': line_count  # 注意：這是檔案行數，不是處理的資料筆數
            })
    
    # 按文件名排序
    output_files.sort(key=lambda x: x['name'])
    
    # 生成摘要信息
    now = datetime.now()
    summary = {
        'start_time': now,  # 傳遞 datetime 對象
        'end_time': now,    # 傳遞 datetime 對象
        'duration': 0,  # 實際應用中可以計算實際耗時
        'rows_per_second': 0  # 實際應用中可以計算處理速度
    }
    
    return render_template(
        'result.html',
        files=output_files,
        total_rows=total_rows,
        file_count=len(output_files),
        summary=summary,
        output_dir=app.config['OUTPUT_FOLDER']
    )

# 添加模板過濾器
@app.template_filter('datetimeformat')
def datetimeformat(value, format='%Y-%m-%d %H:%M:%S'):
    if value is None:
        return ""
    # 如果 value 是字符串，嘗試轉換為 datetime 對象
    if isinstance(value, str):
        from datetime import datetime
        try:
            # 嘗試解析常見的日期時間格式
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%H:%M:%S'):
                try:
                    value = datetime.strptime(value, fmt)
                    break
                except ValueError:
                    continue
        except (ValueError, TypeError):
            return value  # 如果轉換失敗，返回原始值
    # 如果是 datetime 對象，格式化輸出
    if hasattr(value, 'strftime'):
        return value.strftime(format)
    return str(value)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
