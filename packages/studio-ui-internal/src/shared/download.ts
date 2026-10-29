import { Parser } from '@json2csv/plainjs';

export const downloadCSVFiles = <T>({ data, title }: { data: T[]; title: string }) => {
  try {
    const result = new Parser().parse(data);
    // Determine browser type
    if (
      (navigator.userAgent.indexOf('compatible') > -1 && navigator.userAgent.indexOf('MSIE') > -1) ||
      navigator.userAgent.indexOf('Edge') > -1
    ) {
      // IE10 or Edge browsers
      const BOM = '\uFEFF';
      const csvData = new Blob([BOM + result], { type: 'text/csv' });
      // @ts-ignore
      navigator.msSaveBlob?.(csvData, `test.csv`);
    } else {
      // Non-Internet Explorer
      const blob = new Blob(['\ufeff' + result], { type: 'text/csv;charset=utf-8;' });
      // Use the download property of the A tag to implement the download function
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    alert(err);
  }
};
