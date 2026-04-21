import React from "react";
import { Download, FileText, FileType2 } from "lucide-react";

function iconByName(fileName = "") {
  const n = String(fileName || "").toLowerCase();
  if (n.endsWith(".pdf")) return <FileType2 className="h-4 w-4 text-red-500" />;
  return <FileText className="h-4 w-4 text-blue-500" />;
}

export default function FileMessageCard({ url, name, isMine }) {
  if (!url) return null;
  const fileName = name || "Tep dinh kem";
  return (
    <div
      className={`mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 ${
        isMine ? "border-blue-200 bg-blue-50 text-slate-800" : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {iconByName(fileName)}
      <span className="max-w-[170px] truncate text-xs font-medium">{fileName}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download={fileName}
        className="ml-auto rounded-md bg-white p-1 text-slate-600 hover:text-slate-800"
        title="Tải xuống"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
