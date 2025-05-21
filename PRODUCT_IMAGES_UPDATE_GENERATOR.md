# Product Images SQL Update Generator

This script processes TSV/CSV files containing product image data and generates SQL UPDATE statements for the `mms.PRODUCT_IMAGES` table. The script is designed to handle large datasets by splitting the output into multiple files with a configurable batch size.

## Features

- Processes both TSV and CSV input files
- Generates SQL UPDATE statements for product image data
- Splits output into multiple files for large datasets
- Properly escapes SQL values to prevent injection
- Updates `LAST_UPDATED_BY` and `LAST_UPDATED_DATE` automatically
- Includes `USE mms;` statement in each SQL file

## Requirements

- Python 3.6 or newer
- No external dependencies required

## Installation

1. Clone the repository or download the script
2. Ensure Python is installed on your system

## Usage

### Basic Usage

```bash
python update_product_images.py "path/to/your/file.tsv"
```

### Command Line Options

```
usage: update_product_images.py [-h] [-o OUTPUT_DIR] [-b BATCH_SIZE] input_file

Convert TSV/CSV to SQL UPDATE statements for PRODUCT_IMAGES table.

positional arguments:
  input_file            Path to the input TSV/CSV file

optional arguments:
  -h, --help            show this help message and exit
  -o OUTPUT_DIR, --output-dir OUTPUT_DIR
                        Output directory for SQL files (default: output/)
  -b BATCH_SIZE, --batch-size BATCH_SIZE
                        Number of rows per output file (default: 10000)
```

### Examples

1. Process a TSV file with default settings:
   ```bash
   python update_product_images.py "data/product_images.tsv"
   ```

2. Process a CSV file with custom output directory and batch size:
   ```bash
   python update_product_images.py "data/product_images.csv" --output-dir "sql_updates" --batch-size 5000
   ```

## Input File Format

The input file should be a TSV or CSV file with the following columns:

- `STOREFRONT_STORE_CODE` (not used in SQL generation)
- `PRODUCT_CODE` (not used in SQL generation)
- `SKU_CODE` (not used in SQL generation)
- `PRODUCT_IMAGE_ID` (used as the WHERE condition)
- `PRODUCT_ID` (not used in SQL generation)
- `IMAGE_TYPE` (not used in SQL generation)
- `FILE_NAME` (updated in the database)
- `FILE_PATH` (updated in the database)
- `URL_ID` (updated in the database)

### Example Input

```
STOREFRONT_STORE_CODE	PRODUCT_CODE	SKU_CODE	PRODUCT_IMAGE_ID	PRODUCT_ID	IMAGE_TYPE	FILE_NAME	FILE_PATH	URL_ID
C0151001	HK010	HK010	81876365	9810590	main	dXrMVwpFZY20211130141626.jpg	https://example.com/image1.jpg	dXrMVwpFZY20211130141626
```

## Generated SQL Format

The script generates SQL files with the following format:

```sql
USE mms;

UPDATE mms.PRODUCT_IMAGES SET FILE_NAME = 'dXrMVwpFZY20211130141626.jpg', FILE_PATH = 'https://example.com/image1.jpg', URL_ID = 'dXrMVwpFZY20211130141626', LAST_UPDATED_BY = 'SYSTEM', LAST_UPDATED_DATE = NOW() WHERE ID = 81876365;
UPDATE mms.PRODUCT_IMAGES SET FILE_NAME = 'UNqOohXcXE20211130142108.jpg', FILE_PATH = 'https://example.com/image2.jpg', URL_ID = 'UNqOohXcXE20211130142108', LAST_UPDATED_BY = 'SYSTEM', LAST_UPDATED_DATE = NOW() WHERE ID = 81879986;
```

## Output Files

- The script creates one or more SQL files in the specified output directory
- Files are named in the format: `{input_filename}_part_{number:03d}.sql`
- Each file contains up to the specified number of UPDATE statements (default: 10,000)
- The last file may contain fewer statements if the total number of rows is not evenly divisible by the batch size

## Customization

You can modify the script to:

- Change the default batch size (edit the `DEFAULT_BATCH_SIZE` constant)
- Change the `LAST_UPDATED_BY` value (currently 'SYSTEM')
- Modify the SQL statement format in the `process_tsv_to_sql` function
- Add or remove fields being updated in the SQL statements

## Error Handling

The script includes basic error handling for:
- Missing input files
- Missing required columns in the input file
- File permission issues
- Invalid data formats

## License

[Specify your license here]

## Author

[Your name and contact information]
