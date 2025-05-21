// Main JavaScript for SQL Update Generator

// 使用 IIFE 封裝代碼，避免全局變數污染
(function() {
    // 模組變數
    let currentFile = null;
    
    // --- Utility Functions ---
    const Utils = {
        preventDefaults: function(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        
        highlight: function(element) {
            if (element) {
                element.classList.add('bg-light');
            }
        },
        
        unhighlight: function(element) {
            if (element) {
                element.classList.remove('bg-light');
            }
        },
        
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        showAlert: function(message, type = 'danger') {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
            alertDiv.role = 'alert';
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            const container = document.querySelector('.container');
            if (container) {
                container.prepend(alertDiv);
                
                // 5秒後自動關閉提示
                setTimeout(() => {
                    const alert = bootstrap.Alert.getOrCreateInstance(alertDiv);
                    if (alert) {
                        alert.close();
                    }
                }, 5000);
            }
        }
    };

    // --- Event Delegation ---
    function setupEventDelegation() {
        const container = document.querySelector('.container');
        if (!container) return;
        
        // 處理刪除識別欄位
        container.addEventListener('click', function(e) {
            if (e.target.closest('#identifiers-container .remove-btn:not(:disabled)')) {
                const row = e.target.closest('.identifier-row');
                if (row && document.querySelectorAll('#identifiers-container .identifier-row').length > 1) {
                    row.remove();
                    // 如果只剩下一行，禁用其刪除按鈕
                    const remainingRows = document.querySelectorAll('#identifiers-container .identifier-row');
                    if (remainingRows.length === 1) {
                        const deleteBtn = remainingRows[0].querySelector('.remove-btn');
                        if (deleteBtn) deleteBtn.disabled = true;
                    }
                } else {
                    alert('至少需要一個識別欄位');
                }
            }
            // 處理刪除更新欄位
            else if (e.target.closest('#update-columns-container .remove-btn:not(:disabled)')) {
                const row = e.target.closest('.update-column-row');
                if (row) {
                    row.remove();
                }
            }
            // 處理刪除靜態值
            else if (e.target.closest('#static-values-container .remove-btn:not(:disabled)')) {
                const row = e.target.closest('.static-value-row');
                if (row) {
                    row.remove();
                }
            }
        });
    }

    // --- SQL Preview Modal ---
    function initSQLPreview() {
        // 綁定預覽按鈕點擊事件
        document.addEventListener('click', function(e) {
            if (e.target.closest('.view-sql')) {
                e.preventDefault();
                const button = e.target.closest('.view-sql');
                const filename = button.getAttribute('data-filename');
                showSQLPreview(filename);
            }
        });

        // 綁定複製按鈕點擊事件
        const copyBtn = document.getElementById('copy-sql');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                const sqlContent = document.getElementById('sql-content');
                if (sqlContent) {
                    navigator.clipboard.writeText(sqlContent.textContent)
                        .then(() => {
                            const originalText = copyBtn.innerHTML;
                            copyBtn.innerHTML = '<i class="fas fa-check me-1"></i> 已複製';
                            setTimeout(() => {
                                copyBtn.innerHTML = originalText;
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('複製失敗:', err);
                        });
                }
            });
        }

        // 綁定下載按鈕點擊事件
        const downloadBtn = document.getElementById('download-single');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function(e) {
                const filename = document.getElementById('sql-filename').textContent;
                if (filename) {
                    this.href = `/download/${filename}`;
                } else {
                    e.preventDefault();
                }
            });
        }
    }
    
    // 顯示 SQL 預覽
    function showSQLPreview(filename) {
        const modal = new bootstrap.Modal(document.getElementById('sqlPreviewModal'));
        const sqlFilename = document.getElementById('sql-filename');
        const sqlContent = document.getElementById('sql-content');
        const downloadBtn = document.getElementById('download-single');
        
        if (!sqlFilename || !sqlContent) return;
        
        // 顯示載入中
        sqlFilename.textContent = filename;
        sqlContent.textContent = '載入中...';
        
        // 設置下載連結
        if (downloadBtn) {
            downloadBtn.href = `/download/${filename}`;
        }
        
        // 顯示 Modal
        modal.show();
        
        // 獲取 SQL 內容
        fetch(`/preview/${filename}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('無法載入 SQL 內容');
                }
                return response.text();
            })
            .then(content => {
                sqlContent.textContent = content;
                // 重新高亮代碼
                if (window.Prism) {
                    Prism.highlightElement(sqlContent);
                }
            })
            .catch(error => {
                console.error('Error fetching SQL content:', error);
                sqlContent.textContent = `載入 SQL 內容時出錯: ${error.message}`;
            });
    }

    // --- Dynamic Form Row Handling ---
    function addIdentifierRow() {
        const container = document.getElementById('identifiers-container');
        if (!container) return;
        
        const templateRow = container.querySelector('.identifier-row');
        if (!templateRow) return;
        
        const newRow = templateRow.cloneNode(true);
        
        // 清除輸入值
        newRow.querySelectorAll('input').forEach(input => input.value = '');
        newRow.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
        
        // 移除現有的刪除按鈕列（如果存在）
        const existingRemoveCol = newRow.querySelector('.remove-col');
        if (existingRemoveCol) {
            existingRemoveCol.remove();
        }
        
        // 調整欄位寬度
        const fields = newRow.querySelectorAll('.col-md-5, .col-md-2');
        fields.forEach(field => {
            if (field.classList.contains('col-md-5')) {
                field.className = 'col-md-4';
            } else if (field.classList.contains('col-md-2')) {
                field.className = 'col-md-3';
            }
        });
        
        // 創建刪除按鈕列
        const removeCol = document.createElement('div');
        removeCol.className = 'col-md-1 d-flex align-items-center remove-col';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm remove-btn mt-4';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.setAttribute('aria-label', '移除此識別欄位');
        
        removeCol.appendChild(removeBtn);
        newRow.appendChild(removeCol);
        
        // 確保行有正確的類
        newRow.className = 'row g-3 mb-3 align-items-end identifier-row';
        
        // 啟用刪除按鈕（如果這是第二行或更多）
        const rows = container.querySelectorAll('.identifier-row');
        if (rows.length > 1) {
            rows[0].querySelector('.remove-btn').disabled = false;
        }
        
        container.appendChild(newRow);

        // Announce row addition
        const announcementSpan = document.getElementById('dynamic-row-announcement');
        if (announcementSpan) {
            announcementSpan.textContent = '已新增一個識別欄位列。';
            setTimeout(() => { announcementSpan.textContent = ''; }, 3000); // Clear after a few seconds
        }
    }

    // 添加更新欄位行
    function addUpdateColumnRow() {
        const container = document.getElementById('update-columns-container');
        if (!container) return;
        
        const templateRow = container.querySelector('.update-column-row');
        if (!templateRow) return;
        
        const newRow = templateRow.cloneNode(true);
        
        // 清除輸入值
        newRow.querySelectorAll('input').forEach(input => input.value = '');
        newRow.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
        
        // 移除現有的刪除按鈕列（如果存在）
        const existingRemoveCol = newRow.querySelector('.remove-col');
        if (existingRemoveCol) {
            existingRemoveCol.remove();
        }
        
        // 調整欄位寬度
        const fields = newRow.querySelectorAll('.col-md-5, .col-md-2');
        fields.forEach(field => {
            if (field.classList.contains('col-md-5')) {
                field.className = 'col-md-4';
            } else if (field.classList.contains('col-md-2')) {
                field.className = 'col-md-3';
            }
        });
        
        // 創建刪除按鈕列
        const removeCol = document.createElement('div');
        removeCol.className = 'col-md-1 d-flex align-items-center remove-col';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm remove-btn mt-4';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.setAttribute('aria-label', '移除此更新欄位');
        
        removeCol.appendChild(removeBtn);
        newRow.appendChild(removeCol);
        
        // 確保行有正確的類
        newRow.className = 'row g-3 mb-3 align-items-end update-column-row';
        
        container.appendChild(newRow);

        // Announce row addition
        const announcementSpan = document.getElementById('dynamic-row-announcement');
        if (announcementSpan) {
            announcementSpan.textContent = '已新增一個更新欄位列。';
            setTimeout(() => { announcementSpan.textContent = ''; }, 3000);
        }
    }

    // 添加靜態值行
    function addStaticValueRow() {
        const container = document.getElementById('static-values-container');
        if (!container) return;
        
        const templateRow = container.querySelector('.static-value-row');
        if (!templateRow) return;
        
        const newRow = templateRow.cloneNode(true);
        
        // 清除輸入值
        newRow.querySelectorAll('input').forEach(input => input.value = '');
        
        // 移除現有的刪除按鈕列（如果存在）
        const existingRemoveCol = newRow.querySelector('.remove-col');
        if (existingRemoveCol) {
            existingRemoveCol.remove();
        }
        
        // 調整欄位寬度
        const fields = newRow.querySelectorAll('.col-md-5');
        fields.forEach(field => {
            field.className = 'col-md-5';
        });
        
        // 創建刪除按鈕列
        const removeCol = document.createElement('div');
        removeCol.className = 'col-md-2 d-flex align-items-center remove-col';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm remove-btn mt-4';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.setAttribute('aria-label', '移除此靜態值');
        
        removeCol.appendChild(removeBtn);
        newRow.appendChild(removeCol);
        
        // 確保行有正確的類
        newRow.className = 'row g-3 mb-3 align-items-end static-value-row';
        
        container.appendChild(newRow);

        // Announce row addition
        const announcementSpan = document.getElementById('dynamic-row-announcement');
        if (announcementSpan) {
            announcementSpan.textContent = '已新增一個靜態值列。';
            setTimeout(() => { announcementSpan.textContent = ''; }, 3000);
        }
    }

    // --- File Upload and Handling ---
    function handleDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        handleFiles(files);
    }

    // 處理文件選擇
    function handleFiles(files) {
        const file = files[0];
        if (!file) return;
        
        // 檢查檔案類型
        const fileType = file.name.split('.').pop().toLowerCase();
        if (fileType !== 'tsv' && fileType !== 'csv') {
            alert('只支援 TSV 或 CSV 檔案');
            return;
        }
        
        // 更新 UI 顯示檔案資訊
        const fileInfo = document.getElementById('file-info');
        if (fileInfo) fileInfo.style.display = 'block';
        const fileName = document.getElementById('file-name');
        if (fileName) fileName.textContent = file.name;
        const fileSize = document.getElementById('file-size');
        if (fileSize) fileSize.textContent = `(${Utils.formatFileSize(file.size)})`;
        
        // 上傳檔案並處理結果
        uploadFile(file)
            .then(filename => {
                // 上傳成功後重定向到配置頁面
                window.location.href = `/configure?filename=${encodeURIComponent(filename)}`;
            })
            .catch(error => {
                console.error('上傳失敗:', error);
                Utils.showAlert('上傳文件失敗: ' + error.message, 'danger');
            });
    }

    // 處理文件上傳
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 檢查文件類型
        const fileType = file.name.split('.').pop().toLowerCase();
        if (fileType !== 'csv' && fileType !== 'tsv' && fileType !== 'txt') {
            Utils.showAlert('請上傳 CSV 或 TSV 文件', 'danger');
            return;
        }
        
        currentFile = file;
        
        // 顯示文件名稱
        const fileNameDisplay = document.getElementById('file-name');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = file.name;
        }
        
        // 啟用配置按鈕
        const configureBtn = document.getElementById('configure-btn');
        if (configureBtn) {
            configureBtn.disabled = false;
        }
        
        // 預覽文件內容
        previewFile(file);
    }

    // 預覽文件內容
    function previewFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewContainer = document.getElementById('file-preview');
            if (!previewContainer) return;
            
            const content = e.target.result;
            const lines = content.split('\n').slice(0, 10); // 只顯示前10行
            
            let html = '<table class="table table-sm table-bordered">';
            lines.forEach((line, index) => {
                if (!line.trim()) return;
                const cells = line.split('\t');
                html += '<tr>';
                cells.forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += '</tr>';
            });
            html += '</table>';
            
            if (lines.length === 0) {
                html = '<div class="alert alert-warning">檔案為空或格式不正確</div>';
            }
            
            previewContainer.innerHTML = html;
        };
        
        reader.readAsText(file);
    }

    // 上傳文件到服務器
    function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const fileInput = document.getElementById('file-input');
        const selectFileBtn = document.getElementById('select-file-btn');
        const buttonText = selectFileBtn ? selectFileBtn.querySelector('.button-text') : null;
        const originalButtonHTML = buttonText ? buttonText.innerHTML : '';

        if (fileInput) fileInput.disabled = true;
        if (selectFileBtn) selectFileBtn.disabled = true;
        if (buttonText) {
            buttonText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上傳中...';
        }
        
        return fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('上傳失敗');
            }
            return response.json();
        })
        .then(data => {
            return data.filename;
        })
        .catch(error => {
            console.error('Error:', error);
            Utils.showAlert('上傳文件時出錯: ' + error.message, 'danger');
            if (fileInput) fileInput.disabled = false;
            if (selectFileBtn) selectFileBtn.disabled = false;
            if (buttonText) buttonText.innerHTML = originalButtonHTML;
            throw error;
        });
    }

    // 初始化檔案上傳相關功能 (This function is part of File Upload and Handling)
    function initFileUpload() {
        const fileUploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        
        if (!fileUploadArea || !fileInput) return;
        
        // 初始化文件輸入
        fileInput.value = '';
        
        // 處理拖放事件
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, Utils.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, () => Utils.highlight(fileUploadArea), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadArea.addEventListener(eventName, () => Utils.unhighlight(fileUploadArea), false);
        });
        
        // 處理文件拖放
        fileUploadArea.addEventListener('drop', handleDrop, false);
        
        // 處理文件選擇
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files.length > 0) {
                handleFiles(this.files);
            }
        });
        
        // 點擊上傳區域觸發文件選擇
        fileUploadArea.addEventListener('click', function(e) {
            // Check if the click is directly on the area or its button, but not on other interactive elements within
            if (e.target === fileUploadArea || e.target.closest('#select-file-btn')) {
                 if (fileInput) fileInput.click();
            }
        });

        // 鍵盤操作上傳區域
        fileUploadArea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // 防止空格鍵滾動頁面
                if (fileInput) fileInput.click();
            }
        });
    }

    // --- Initialization ---
    function init() {
        // 設置事件委託
        setupEventDelegation();
        
        // 添加識別欄位按鈕事件監聽
        const addIdentifierBtn = document.getElementById('add-identifier');
        if (addIdentifierBtn) {
            addIdentifierBtn.addEventListener('click', addIdentifierRow);
        }
        
        // 添加更新欄位按鈕事件監聽
        const addUpdateColumnBtn = document.getElementById('add-update-column');
        if (addUpdateColumnBtn) {
            addUpdateColumnBtn.addEventListener('click', addUpdateColumnRow);
        }
        
        // 添加靜態值按鈕事件監聽
        const addStaticValueBtn = document.getElementById('add-static-value');
        if (addStaticValueBtn) {
            addStaticValueBtn.addEventListener('click', addStaticValueRow);
        }
        
        // 添加生成SQL按鈕事件監聽
        const generateSQLBtn = document.getElementById('generate-btn');
        if (generateSQLBtn) {
            generateSQLBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleGenerateSQL(); // This function will be defined below or should exist
            });
        }
        
        // 初始化檔案上傳相關事件
        initFileUpload();
    }

    // --- Initialization ---

    // Function to handle SQL generation and validation
    async function handleGenerateSQL() {
        const generateBtn = document.getElementById('generate-btn');
        const originalBtnHTML = generateBtn.innerHTML;
        const progressModalElement = document.getElementById('progressModal');
        const progressModal = progressModalElement ? new bootstrap.Modal(progressModalElement) : null;
        const progressBar = document.getElementById('progress-bar');

        // --- Client-side Validation ---
        const dbName = document.getElementById('db-name').value.trim();
        const tableName = document.getElementById('table-name').value.trim();
        const batchSize = document.getElementById('batch-size').value.trim();

        if (!dbName) {
            Utils.showAlert('資料庫名稱不能為空。', 'danger');
            return;
        }
        if (!tableName) {
            Utils.showAlert('資料表名稱不能為空。', 'danger');
            return;
        }
        if (!batchSize || parseInt(batchSize) <= 0) {
            Utils.showAlert('每批次行數必須為正整數。', 'danger');
            return;
        }

        const identifierRows = document.querySelectorAll('#identifiers-container .identifier-row');
        if (identifierRows.length === 0) {
            Utils.showAlert('請至少設定一個識別欄位。', 'danger');
            return;
        }
        for (let i = 0; i < identifierRows.length; i++) {
            const dbCol = identifierRows[i].querySelector('.db-column').value.trim();
            const fileCol = identifierRows[i].querySelector('.file-column').value;
            if (!dbCol) {
                Utils.showAlert(`識別欄位 #${i + 1} 的資料庫欄位名稱不能為空。`, 'danger');
                return;
            }
            if (!fileCol) {
                Utils.showAlert(`識別欄位 #${i + 1} 的檔案欄位必須選擇。`, 'danger');
                return;
            }
        }

        const updateColumnRows = document.querySelectorAll('#update-columns-container .update-column-row');
        const staticValueRows = document.querySelectorAll('#static-values-container .static-value-row');

        let hasUpdateColumns = false;
        if (updateColumnRows.length > 0) {
            for (let i = 0; i < updateColumnRows.length; i++) {
                const dbCol = updateColumnRows[i].querySelector('.db-column').value.trim();
                const fileCol = updateColumnRows[i].querySelector('.file-column').value;
                // Check only if at least one field in the row is filled, implying the user intends to use this row
                if (dbCol || fileCol) {
                    hasUpdateColumns = true;
                    if (!dbCol) {
                        Utils.showAlert(`更新欄位 #${i + 1} 的資料庫欄位名稱不能為空。`, 'danger');
                        return;
                    }
                    if (!fileCol) {
                        Utils.showAlert(`更新欄位 #${i + 1} 的檔案欄位必須選擇。`, 'danger');
                        return;
                    }
                } else if (updateColumnRows.length === 1 && !dbCol && !fileCol) {
                    // If it's the only row and it's empty, it's fine, it just means no update columns.
                    // This case will be caught by the combined check later if no static values either.
                }
            }
        }
        
        let hasStaticValues = false;
        if (staticValueRows.length > 0) {
            for (let i = 0; i < staticValueRows.length; i++) {
                const fieldName = staticValueRows[i].querySelector('.field-name').value.trim();
                const fieldValue = staticValueRows[i].querySelector('.field-value').value.trim();
                if (fieldName || fieldValue) { // If either is filled, consider it an attempt to add a static value
                    hasStaticValues = true;
                    if (!fieldName) {
                        Utils.showAlert(`靜態值 #${i + 1} 的欄位名稱不能為空。`, 'danger');
                        return;
                    }
                    if (!fieldValue && fieldName) { // FieldValue can be intentionally empty if fieldName is also empty (for an empty row)
                                                // But if fieldName is there, fieldValue must be there.
                        Utils.showAlert(`靜態值 #${i + 1} 的值不能為空（當欄位名稱已填寫時）。`, 'danger');
                        return;
                    }
                } else if (staticValueRows.length === 1 && !fieldName && !fieldValue){
                    // Single empty row is fine, means no static values.
                }
            }
        }

        if (!hasUpdateColumns && !hasStaticValues) {
            Utils.showAlert('請至少設定一個更新欄位或一個靜態值。', 'danger');
            return;
        }
        // --- End of Validation ---

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>生成中...';
        if (progressModal) {
            if(progressBar) progressBar.style.width = '0%'; // Reset progress bar
            progressModal.show();
        }

        try {
            // Simulate progress for demonstration (remove in production)
            if (progressBar) {
                let currentProgress = 0;
                const progressInterval = setInterval(() => {
                    currentProgress += 10;
                    if (currentProgress <= 100) {
                        progressBar.style.width = currentProgress + '%';
                    } else {
                        clearInterval(progressInterval);
                    }
                }, 200);
            }

            // Collect form data
            const identifiers = Array.from(identifierRows).map(row => ({
                db_column: row.querySelector('.db-column').value.trim(),
                file_column: row.querySelector('.file-column').value,
                data_type: row.querySelector('.data-type').value
            }));

            const update_columns = Array.from(updateColumnRows).map(row => {
                const dbCol = row.querySelector('.db-column').value.trim();
                const fileCol = row.querySelector('.file-column').value;
                if (!dbCol && !fileCol) return null; // Skip fully empty rows
                return {
                    db_column: dbCol,
                    file_column: fileCol,
                    data_type: row.querySelector('.data-type').value
                };
            }).filter(col => col !== null);

            const static_values = Array.from(staticValueRows).map(row => {
                const fieldName = row.querySelector('.field-name').value.trim();
                const fieldValue = row.querySelector('.field-value').value.trim();
                if (!fieldName) return null; // Skip rows where field name is empty
                return {
                    field_name: fieldName,
                    field_value: fieldValue
                };
            }).filter(val => val !== null);
            
            const data = {
                filename: document.getElementById('selected-file').textContent,
                db_name: dbName,
                table_name: tableName,
                batch_size: parseInt(batchSize),
                file_has_header: document.getElementById('file-has-header').checked,
                identifiers: identifiers,
                update_columns: update_columns,
                static_values: static_values
            };

            // Actual fetch call
            const response = await fetch('/generate_sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '無法解析錯誤回應，請檢查網路連線或聯絡管理員。' }));
                throw new Error(errorData.message || `伺服器錯誤: ${response.status}`);
            }

            const result = await response.json();
            // Assuming the server sends back a URL to the results page or a success message
            if (result.redirect_url) {
                 // Store the result summary in sessionStorage to display on the results page
                if (result.summary) {
                    sessionStorage.setItem('generationResultSummary', JSON.stringify(result.summary));
                }
                window.location.href = result.redirect_url;
            } else {
                // Handle cases where there's no redirect, maybe show files directly or a message
                Utils.showAlert(result.message || 'SQL 生成成功！但未收到重定向指令。', 'success');
            }

        } catch (error) {
            console.error('生成 SQL 錯誤:', error); // Log the full error for debugging
            Utils.showAlert('生成 SQL 時發生錯誤: ' + error.message, 'danger');
        } finally {
            if (progressModal) progressModal.hide();
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalBtnHTML;
        }
    }

    // 頁面加載完成後初始化
    // Note: The main init() and initSQLPreview() are called here.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init();
            initSQLPreview();
        });
    } else {
        init();
        initSQLPreview();
    }
})(); // 結束 IIFE
