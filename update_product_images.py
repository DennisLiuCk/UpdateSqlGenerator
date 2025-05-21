import csv
import os
import yaml
import argparse
from typing import Dict, List, Any, Optional
from pathlib import Path

def load_config(config_file: str) -> Dict[str, Any]:
    """Load and validate configuration from YAML file."""
    with open(config_file, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # Validate required fields
    required_sections = ['database', 'input', 'identifiers', 'update_columns']
    for section in required_sections:
        if section not in config:
            raise ValueError(f"Missing required section in config: {section}")
    
    return config

def escape_sql_value(value: Any, is_numeric: bool = False) -> str:
    """
    Escape and format SQL values properly.
    
    Args:
        value: The value to escape
        is_numeric: Whether the value should be treated as numeric
        
    Returns:
        str: Properly escaped SQL value
    """
    if value is None:
        return 'NULL'
    
    # Convert value to string and strip whitespace
    str_value = str(value).strip()
    
    # Handle empty strings
    if not str_value:
        return 'NULL'
    
    # Handle numeric values
    if is_numeric:
        try:
            # Try to convert to float to check if it's a valid number
            float(str_value)
            return str_value
        except ValueError:
            # If conversion fails, treat as string
            pass
    
    # Handle boolean values
    if str_value.lower() in ('true', 'false'):
        return str_value.upper()
    
    # Handle NULL values
    if str_value.upper() == 'NULL':
        return 'NULL'
        
    # Handle date/time functions
    if str_value.upper() in ('CURRENT_TIMESTAMP', 'NOW()', 'GETDATE()', 'SYSDATE'):
        return str_value.upper()
    
    # Escape single quotes by doubling them
    escaped_value = str_value.replace("'", "''")
    
    # Return the escaped string
    return f"'{escaped_value}'"

def generate_update_sql(row: Dict[str, str], config: Dict[str, Any]) -> Optional[str]:
    """
    Generate a single UPDATE SQL statement.
    
    Args:
        row: Dictionary containing row data
        config: Configuration dictionary
        
    Returns:
        str: Generated SQL statement or None if there was an error
    """
    try:
        # Build WHERE clause
        where_parts = []
        for id_field in config.get('identifiers', []):
            col_name = id_field.get('column', '')
            if not col_name:
                print("Warning: Missing column name in identifier configuration")
                continue
                
            if col_name not in row:
                print(f"Warning: Missing identifier column '{col_name}' in input data")
                return None
            
            # Determine if the value should be treated as numeric
            is_numeric = id_field.get('is_numeric', False)
            if 'data_type' in id_field and id_field['data_type'] == 'number':
                is_numeric = True
                
            value = escape_sql_value(row[col_name], is_numeric)
            where_parts.append(f"{id_field.get('name', col_name)} = {value}")
        
        if not where_parts:
            print("Error: No valid identifiers found for WHERE clause")
            return None
        
        # Build SET clause
        set_parts = []
        
        # Add dynamic columns from the input file
        for col in config.get('update_columns', []):
            col_name = col.get('column', '')
            if not col_name:
                print("Warning: Missing column name in update columns configuration")
                continue
                
            if col_name not in row:
                print(f"Warning: Missing update column '{col_name}' in input data")
                continue
                
            # Determine if the value should be treated as numeric
            is_numeric = False
            if 'data_type' in col:
                is_numeric = col['data_type'] == 'number'
            elif 'is_numeric' in col:
                is_numeric = bool(col['is_numeric'])
                
            value = escape_sql_value(row[col_name], is_numeric)
            set_parts.append(f"{col.get('name', col_name)} = {value}")
        
        # Add static values
        static_values = config.get('static_values', {})
        if isinstance(static_values, dict):
            for key, value in static_values.items():
                if value is not None and str(value).strip() != '':
                    # Check if the value is a function like NOW()
                    if isinstance(value, str) and value.endswith('()'):
                        set_parts.append(f"{key} = {value}")
                    else:
                        # Escape the value properly
                        escaped_value = escape_sql_value(value, False)
                        set_parts.append(f"{key} = {escaped_value}")
        
        if not set_parts:
            print("Warning: No valid columns to update")
            return None
        
        # Get database and table names with defaults
        db_name = config.get('database', {}).get('name', 'mms')
        table_name = config.get('database', {}).get('table', 'PRODUCT_IMAGES')
        
        # Build the complete SQL statement
        sql = (
            f"UPDATE {db_name}.{table_name} "
            f"SET {', '.join(set_parts)} "
            f"WHERE {' AND '.join(where_parts)};"
        )
        
        return sql
        
    except Exception as e:
        print(f"Error generating SQL: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def process_file_to_sql(
    input_file: str,
    config: Dict[str, Any],
    output_dir: str = 'output',
    batch_size: Optional[int] = None
) -> Dict[str, Any]:
    """
    Process input file and generate SQL UPDATE statements in batches.
    
    Args:
        input_file: Path to the input file (TSV/CSV)
        config: Configuration dictionary
        output_dir: Directory to save SQL files
        batch_size: Number of rows per output file
        
    Returns:
        Dict containing processing results
    """
    # Create output directory if it doesn't exist
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get base filename without extension
    base_filename = Path(input_file).stem
    
    # Initialize variables
    row_count = 0
    file_count = 1
    output_file = None
    output_files = []
    
    # Get batch size from config if not provided
    if batch_size is None:
        batch_size = config.get('batch', {}).get('size', 10000)
    
    # Determine the file format and delimiter
    input_config = config.get('input', {})
    delimiter = '\t' if input_config.get('format', '').lower() == 'tsv' else ','
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            # Read the input file
            reader = csv.DictReader(
                f,
                delimiter=delimiter,
                fieldnames=None if input_config.get('has_header', True) else [col['column'] for col in config.get('update_columns', [])]
            )
            
            for row in reader:
                # Skip empty rows
                if not any(row.values()):
                    continue
                    
                # Create new output file if needed
                if row_count % batch_size == 0:
                    if output_file:
                        output_file.close()
                    
                    output_filename = f"{base_filename}_part_{file_count:03d}.sql"
                    output_path = output_dir / output_filename
                    output_file = open(output_path, 'w', encoding='utf-8')
                    output_files.append(output_path.name)
                    
                    # Add USE statement at the beginning of each file
                    db_name = config.get('database', {}).get('name', 'mms')
                    output_file.write(f'USE {db_name};\n\n')
                    file_count += 1
                
                # Generate and write the SQL statement
                sql = generate_update_sql(row, config)
                if sql:
                    output_file.write(sql + '\n')
                    row_count += 1
                    
                    # Add a newline between statements for better readability
                    if (row_count % 100) == 0:
                        output_file.write('\n')
        
        result = {
            'success': True,
            'row_count': row_count,
            'file_count': len(output_files),
            'output_files': output_files,
            'output_dir': str(output_dir.absolute())
        }
        print(f"Processed {row_count} rows. Output files saved to: {output_dir.absolute()}")
        return result
        
    except Exception as e:
        error_msg = f"Error processing file: {str(e)}"
        print(error_msg)
        return {
            'success': False,
            'error': error_msg,
            'row_count': row_count,
            'file_count': len(output_files),
            'output_files': output_files,
            'output_dir': str(output_dir.absolute())
        }
    finally:
        if output_file and not output_file.closed:
            output_file.close()



def main():
    parser = argparse.ArgumentParser(description='Generate SQL UPDATE statements from TSV/CSV files.')
    
    # Arguments
    parser.add_argument('config_file', 
                      help='Path to the YAML configuration file',
                      nargs='?',  # 使參數變為可選
                      default='config/product_images_update.yaml')  # 預設值
    
    # Optional arguments
    parser.add_argument('-i', '--input-file', 
                      help='Path to the input TSV/CSV file (overrides config if specified)')
    parser.add_argument('-o', '--output-dir', 
                      default=None, 
                      help='Output directory for SQL files (overrides config if specified)')
    parser.add_argument('-b', '--batch-size', 
                      type=int, 
                      default=None, 
                      help='Number of rows per output file (overrides config if specified)')
    
    args = parser.parse_args()
    
    # Validate config file
    config_path = Path(args.config_file)
    if not config_path.exists():
        print(f"Error: Config file '{args.config_file}' not found.")
        return 1
    
    # Load configuration
    try:
        config = load_config(args.config_file)
    except Exception as e:
        print(f"Error loading config file: {str(e)}")
        return 1
    
    # Get input file path (command line takes precedence over config)
    input_file = args.input_file
    if input_file is None:
        input_file = config.get('input', {}).get('file')
        if not input_file:
            print("Error: No input file specified in config or command line")
            return 1
    
    # Validate input file
    input_path = Path(input_file)
    if not input_path.exists():
        print(f"Error: Input file '{input_file}' not found.")
        return 1
    
    # Get output directory (command line takes precedence over config)
    output_dir = args.output_dir
    if output_dir is None:
        output_dir = config.get('output', {}).get('dir', 'output')  # 預設為 'output'
    
    try:
        # Process the file
        process_file_to_sql(
            input_file=input_file,
            config=config,
            output_dir=output_dir,
            batch_size=args.batch_size
        )
        
        return 0
        
    except Exception as e:
        print(f"Error: {str(e)}")
        if __debug__:
            import traceback
            traceback.print_exc()
        return 1

if __name__ == "__main__":
    main()
