from io import BytesIO, StringIO
from pathlib import Path
import csv
import re
from zipfile import ZipFile, BadZipFile
import pandas as pd
from openpyxl import load_workbook

MAX_BYTES = 10 * 1024 * 1024
MAX_ROWS = 50000
MAX_COLS = 100


def parse_upload(content: bytes, filename: str):
    name = re.sub(r'[^A-Za-z0-9_. -]', '_', filename.replace('\\', '/').split('/')[-1])[:120] or 'dataset.csv'
    extension = Path(filename).suffix.lower()
    if extension not in ('.csv', '.xlsx'):
        raise ValueError('Upload a CSV or XLSX file.')
    if len(content) > MAX_BYTES:
        raise ValueError('File exceeds the 10 MB upload limit.')
    if not content:
        raise ValueError('The uploaded file is empty.')
    if extension == '.csv':
        try:
            decoded = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            raise ValueError('CSV must use UTF-8 encoding. Re-save the file as CSV UTF-8.')
        reader = csv.reader(StringIO(decoded, newline=''), strict=True)
        try:
            headers = next(reader, [])
        except csv.Error as error:
            raise ValueError(f'Invalid CSV header: {error}')
        if len(headers) > MAX_COLS:
            raise ValueError('Datasets may contain at most 100 columns.')
        if len(set(headers)) != len(headers) or any(not h.strip() for h in headers):
            raise ValueError('Every column needs a unique, non-empty header.')
        row_limit = min(MAX_ROWS, 2_000_000 // max(len(headers), 1))
        observed_rows = 0
        try:
            for row in reader:
                if not row:
                    continue
                if len(row) != len(headers):
                    raise ValueError(f'CSV record {observed_rows + 2} has {len(row)} fields; expected {len(headers)}. Check delimiters and quoting.')
                observed_rows += 1
                if observed_rows > row_limit:
                    raise ValueError('Limit: 50,000 rows and 2 million cells. Upload a smaller sample.')
        except csv.Error as error:
            raise ValueError(f'Invalid CSV: {error}. Check quoting and keep each field below 128 KB.')
        df = pd.read_csv(BytesIO(content), nrows=row_limit + 1)
    else:
        try:
            with ZipFile(BytesIO(content)) as archive:
                if sum(z.file_size for z in archive.infolist()) > 60 * 1024 * 1024 or len(archive.infolist()) > 1000:
                    raise ValueError('Expanded workbook is too large (60 MB or 1,000 ZIP entries).')
        except BadZipFile:
            raise ValueError('This is not a valid XLSX workbook.')
        try:
            book = load_workbook(BytesIO(content), read_only=True, data_only=True)
        except Exception as error:
            raise ValueError('XLSX could not be read. Use an unencrypted, valid Excel workbook.') from error
        try:
            sheet = book.worksheets[0]
            if sheet.max_column and sheet.max_column > MAX_COLS:
                raise ValueError('Datasets may contain at most 100 columns.')
            rows = sheet.iter_rows(values_only=True)
            headers = next(rows, ())
            if not headers or any(h is None or not str(h).strip() for h in headers):
                raise ValueError('Every column needs a non-empty header in the first worksheet.')
            headers = list(map(str, headers))
            if len(headers) > MAX_COLS:
                raise ValueError('Datasets may contain at most 100 columns.')
            if len(set(headers)) != len(headers):
                raise ValueError('Column headers must be unique.')
            values = []
            for row in rows:
                if len(row) != len(headers):
                    raise ValueError('Workbook rows have inconsistent widths.')
                values.append(row)
                if len(values) > min(MAX_ROWS, 2_000_000 // len(headers)):
                    break
            df = pd.DataFrame(values, columns=headers)
        finally:
            book.close()
    if df.empty or not len(df.columns):
        raise ValueError('The dataset needs a header and at least one data row.')
    if len(df) > MAX_ROWS or len(df.columns) > MAX_COLS or df.size > 2_000_000:
        raise ValueError('Limit: 50,000 rows, 100 columns, and 2 million cells. Upload a smaller sample.')
    return name, df
