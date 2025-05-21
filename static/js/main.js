// Main JavaScript for SQL Update Generator

// 使用 IIFE 封裝代碼，避免全局變數污染
(function() {
    // 模組變數
    let currentFile = null;
    
    // 工具函數
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

    // 使用事件委託來處理動態添加的元素的點擊事件
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

    // 初始化 SQL 預覽功能
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

    // 添加識別欄位行
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
        
        removeCol.appendChild(removeBtn);
        newRow.appendChild(removeCol);
        
        // 確保行有正確的類
        newRow.className = 'row g-3 mb-3 align-items-end update-column-row';
        
        container.appendChild(newRow);
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
        
        removeCol.appendChild(removeBtn);
        newRow.appendChild(removeCol);
        
        // 確保行有正確的類
        newRow.className = 'row g-3 mb-3 align-items-end static-value-row';
        
        container.appendChild(newRow);
    }

    // 處理拖放文件
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
            throw error;
        });
    }

    // 初始化應用
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
                handleGenerateSQL();
            });
        }
        
        // 初始化檔案上傳相關事件
        initFileUpload();
    }
    
    // 初始化檔案上傳相關功能
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
            if (e.target === fileUploadArea || e.target === fileUploadArea.querySelector('button')) {
                fileInput.click();
            }
        });
    }

    // 初始化 SQL 預覽功能
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

    // 頁面加載完成後初始化
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
