# SQL 更新語句生成工具 (SQL Update Statement Generator)

這是一個用於從 TSV/CSV 文件生成 SQL UPDATE 語句的工具，特別適合批次更新資料庫記錄。本工具可以幫助開發人員和資料庫管理員輕鬆地將數據文件轉換為可執行的 SQL 語句，簡化資料庫更新流程。

## 目錄
- [功能特點](#功能特點)
- [安裝需求](#安裝需求)
- [快速開始](#快速開始)
  - [基本用法](#基本用法)
  - [進階用法](#進階用法)
- [設定檔說明](#設定檔說明)
- [使用範例](#使用範例)
- [授權](#授權)

## 功能特點

- **多格式支援**：支援 TSV 和 CSV 輸入格式
- **靈活配置**：可自定義識別欄位（WHERE 條件）和更新欄位（SET 子句）
- **批次處理**：支援大量數據的批次處理，可配置每批次處理的記錄數
- **自定義輸出**：可配置輸出目錄和批次大小
- **固定值設定**：支援設定固定更新值
- **日誌記錄**：詳細的執行日誌，方便追蹤和除錯

## 安裝需求

- Python 3.6 或更高版本
- 依賴套件：
  - PyYAML
  - pandas (用於處理大型數據文件)

### 安裝依賴

```bash
# 安裝所有依賴
pip install -r requirements.txt
```

或者只安裝必要套件：

```bash
pip install pyyaml pandas
```

## 專案結構

```
UpdateSqlGenerator/
├── config/                    # 設定檔目錄
│   └── product_images_update.yaml  # 範例設定檔
├── data/                      # 資料文件目錄
│   └── Product_image_data_test.tsv  # 測試資料
├── static/                    # 靜態資源
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── templates/                 # 網頁模板
│   ├── base.html
│   ├── configure.html
│   ├── index.html
│   └── result.html
├── uploads/                   # 上傳文件暫存目錄
├── .gitignore                # Git 忽略設定
├── app.py                    # Flask 應用程序
├── PRODUCT_IMAGES_UPDATE_GENERATOR.md  # 詳細使用文檔
├── README.md                 # 本文件
├── requirements.txt          # 依賴套件列表
└── update_product_images.py  # 主要執行腳本

## 安裝需求

- Python 3.6 或更高版本
- PyYAML 套件

安裝依賴：

```bash
pip install pyyaml
```

## 快速開始

### 基本用法

1. 準備好您的資料文件（TSV 或 CSV 格式）
2. 根據您的需求修改 `config/product_images_update.yaml` 設定檔
3. 執行以下命令：

```bash
python update_product_images.py
```

### 進階用法

```bash
# 指定自定義設定檔
python update_product_images.py path/to/your_config.yaml

# 覆蓋設定檔中的輸入文件
python update_product_images.py -i data/your_data.tsv

# 指定輸出目錄
python update_product_images.py -o output/sql_files

# 設定每個輸出文件的行數
python update_product_images.py -b 5000

# 組合使用多個選項
python update_product_images.py -i data/your_data.tsv -o output/sql_files -b 5000
```

## 使用範例

### 1. 準備資料文件

準備一個 TSV 或 CSV 文件，例如 `data/Product_image_data_test.tsv`，內容範例：

```
PRODUCT_IMAGE_ID	FILE_NAME	FILE_PATH	URL_ID
1	image1.jpg	/images/2023/01	1001
2	image2.jpg	/images/2023/01	1002
```

### 2. 配置設定檔

複製並修改 `config/product_images_update.yaml` 設定檔，根據您的需求調整以下部分：

- 資料庫和資料表名稱
- 輸入文件路徑和格式
- 識別欄位（用於 WHERE 子句）
- 更新欄位（用於 SET 子句）
- 固定更新值

### 3. 執行轉換

```bash
# 使用預設設定檔
python update_product_images.py

# 或指定自定義設定檔
python update_product_images.py config/custom_config.yaml
```

### 4. 查看結果

轉換後的 SQL 文件將保存在 `output/` 目錄下，每個文件包含指定數量的 UPDATE 語句。

## 設定檔說明

設定檔使用 YAML 格式，主要包含以下區段：

```yaml
# 資料庫設定
database:
  name: mms                    # 資料庫名稱
  table: PRODUCT_IMAGES       # 資料表名稱

# 批次處理設定
batch:
  size: 10000                # 每個輸出檔案的行數

# 輸入檔案設定
input:
  file: "data/Product_image_data_test.tsv"  # 輸入檔案路徑
  format: tsv                               # 檔案格式：tsv 或 csv
  has_header: true                         # 是否包含標題行

# 輸出設定
output:
  dir: "output"  # 輸出目錄

# 識別欄位 (用於 WHERE 子句)
identifiers:
  - name: ID                    # 資料庫欄位名稱
    column: PRODUCT_IMAGE_ID     # 來源資料中的欄位名稱
    is_numeric: true            # 是否為數字類型

# 要更新的欄位 (用於 SET 子句)
update_columns:
  - name: FILE_NAME            # 資料庫欄位名稱
    column: FILE_NAME           # 來源資料中的欄位名稱
    is_numeric: false
    
  - name: FILE_PATH
    column: FILE_PATH
    is_numeric: false
    
  - name: URL_ID
    column: URL_ID
    is_numeric: false

# 其他固定值 (會固定更新這些值)
static_values:
  LAST_UPDATED_BY: SYSTEM
  LAST_UPDATED_DATE: NOW()
  # 可以添加更多固定值
  # UPDATED_DATE: SYSDATE
  # STATUS: 'ACTIVE'
```

## 範例

### 輸入檔案範例 (TSV)

```
PRODUCT_IMAGE_ID	FILE_NAME	FILE_PATH	URL_ID
12345	image1.jpg	/path/to/image1	img123
12346	image2.jpg	/path/to/image2	img124
```

### 生成的 SQL 範例

```sql
USE mms;

UPDATE mms.PRODUCT_IMAGES SET FILE_NAME = 'image1.jpg', FILE_PATH = '/path/to/image1', URL_ID = 'img123', LAST_UPDATED_BY = 'SYSTEM', LAST_UPDATED_DATE = NOW() WHERE ID = 12345;
UPDATE mms.PRODUCT_IMAGES SET FILE_NAME = 'image2.jpg', FILE_PATH = '/path/to/image2', URL_ID = 'img124', LAST_UPDATED_BY = 'SYSTEM', LAST_UPDATED_DATE = NOW() WHERE ID = 12346;
```
