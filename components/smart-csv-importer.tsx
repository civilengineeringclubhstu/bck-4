"use client";

import { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  Download,
  Check,
  ChevronDown,
  Info
} from "lucide-react";

export interface TargetFieldDef {
  key: string;
  label: string;
  required?: boolean;
  synonyms: string[];
  description?: string;
  defaultValue?: string;
  type?: "string" | "number" | "date";
}

interface SmartCsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  targetFields: TargetFieldDef[];
  sampleTemplateData?: {
    headers: string[];
    sampleRows: string[][];
    filename: string;
  };
  idFieldKey?: string;
  idPrefix?: string;
  defaultValues?: Record<string, any>;
  onImport: (mappedRows: Record<string, any>[]) => Promise<{ count: number; errors?: string[] }>;
}

export function SmartCsvImporter({
  isOpen,
  onClose,
  title,
  description,
  targetFields,
  sampleTemplateData,
  idFieldKey = "id",
  idPrefix = "ID-",
  defaultValues = {},
  onImport,
}: SmartCsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // csvHeader -> targetFieldKey (or "__SKIP__")
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing">("upload");
  const [autoGenerateId, setAutoGenerateId] = useState(true);
  const [idPrefixInput, setIdPrefixInput] = useState(idPrefix);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: "idle" });
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to normalize header string for fuzzy matching
  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[\s\-_()[\]{}:;,.]/g, "")
      .trim();
  };

  // Smart Auto-Mapping function
  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const assignedTargetKeys = new Set<string>();

    headers.forEach((header) => {
      const cleanHeader = normalizeString(header);
      
      // Check if it's a known non-data or meta column like Timestamp
      if (cleanHeader === "timestamp" || cleanHeader === "submittedat" || cleanHeader === "responsetime") {
        // Auto-assign to skip unless there is a specific target field asking for timestamp
        const timestampTarget = targetFields.find(tf => tf.synonyms.some(s => normalizeString(s) === cleanHeader));
        if (timestampTarget && !assignedTargetKeys.has(timestampTarget.key)) {
          mapping[header] = timestampTarget.key;
          assignedTargetKeys.add(timestampTarget.key);
        } else {
          mapping[header] = "__SKIP__";
        }
        return;
      }

      let bestMatchKey = "__SKIP__";

      // 1. Direct exact or synonym match
      for (const target of targetFields) {
        if (assignedTargetKeys.has(target.key)) continue;

        const isExactMatch = normalizeString(target.label) === cleanHeader || normalizeString(target.key) === cleanHeader;
        const isSynonymMatch = target.synonyms.some(syn => {
          const cleanSyn = normalizeString(syn);
          return cleanSyn === cleanHeader || 
                 cleanHeader.includes(cleanSyn) || 
                 cleanSyn.includes(cleanHeader);
        });

        if (isExactMatch || isSynonymMatch) {
          bestMatchKey = target.key;
          assignedTargetKeys.add(target.key);
          break;
        }
      }

      mapping[header] = bestMatchKey;
    });

    return mapping;
  };

  const handleFileSelected = (selectedFile: File) => {
    setParseError(null);
    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          setParseError("The uploaded CSV file does not contain valid column headers.");
          return;
        }

        const headers = results.meta.fields.filter(h => h && h.trim() !== "");
        const rows = (results.data as Record<string, string>[]).filter(r => {
          // Check if row has at least one non-empty value
          return Object.values(r).some(v => v !== undefined && String(v).trim() !== "");
        });

        if (rows.length === 0) {
          setParseError("The uploaded CSV file does not contain any data rows.");
          return;
        }

        setRawHeaders(headers);
        setRawRows(rows);

        // Auto-map fields
        const detected = autoDetectMapping(headers);
        setColumnMapping(detected);
        setStep("map");
      },
      error: (err) => {
        setParseError("Failed to parse CSV: " + err.message);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setStep("upload");
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Convert raw rows to mapped data objects
  const mappedData = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return rawRows.map((row, index) => {
      const item: Record<string, any> = { ...defaultValues };
      const unmappedExtra: Record<string, string> = {};

      Object.entries(columnMapping).forEach(([csvHeader, targetKey]) => {
        const value = row[csvHeader] !== undefined ? String(row[csvHeader]).trim() : "";
        if (targetKey === "__SKIP__") {
          if (value) {
            unmappedExtra[csvHeader] = value;
          }
          return;
        }

        if (targetKey) {
          item[targetKey] = value;
        }
      });

      // Handle ID Auto-generation if empty
      if (idFieldKey && (!item[idFieldKey] || item[idFieldKey].trim() === "")) {
        if (autoGenerateId) {
          const batchStr = item.batch ? String(item.batch).padStart(2, "0") : String(currentYear).slice(-2);
          const seq = String(index + 1).padStart(3, "0");
          item[idFieldKey] = `${idPrefixInput}${batchStr}-${seq}`;
        }
      }

      // Fill in default values if field empty
      targetFields.forEach(tf => {
        if (tf.defaultValue && (!item[tf.key] || item[tf.key] === "")) {
          item[tf.key] = tf.defaultValue;
        }
      });

      // Attach unmapped fields as extra for full safety
      if (Object.keys(unmappedExtra).length > 0) {
        item._extraRawFields = unmappedExtra;
      }

      return item;
    });
  }, [rawRows, columnMapping, defaultValues, idFieldKey, autoGenerateId, idPrefixInput, targetFields]);

  // Validation summary
  const validationSummary = useMemo(() => {
    const requiredFields = targetFields.filter(f => f.required);
    let invalidRowCount = 0;
    const missingFieldsMap = new Set<string>();

    mappedData.forEach(row => {
      let isRowValid = true;
      requiredFields.forEach(f => {
        if (!row[f.key] || String(row[f.key]).trim() === "") {
          isRowValid = false;
          missingFieldsMap.add(f.label);
        }
      });
      if (!isRowValid) invalidRowCount++;
    });

    return {
      totalRows: mappedData.length,
      validRows: mappedData.length - invalidRowCount,
      invalidRows: invalidRowCount,
      missingFields: Array.from(missingFieldsMap),
      isReady: invalidRowCount === 0
    };
  }, [mappedData, targetFields]);

  // Handle final import
  const handleExecuteImport = async () => {
    if (mappedData.length === 0) return;
    setStep("importing");
    setImportProgress({ current: 0, total: mappedData.length, status: "Saving to database..." });

    try {
      const res = await onImport(mappedData);
      setImportResult({
        success: true,
        message: `Successfully imported ${res.count} items into the system!`,
        count: res.count
      });
    } catch (err: any) {
      console.error("Import error:", err);
      setImportResult({
        success: false,
        message: err.message || "Failed to complete CSV import."
      });
    }
  };

  const handleDownloadSample = () => {
    if (!sampleTemplateData) return;
    const csvContent = [
      sampleTemplateData.headers.join(","),
      ...sampleTemplateData.sampleRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sampleTemplateData.filename || "sample_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200 font-inter">
      <div className="bg-white rounded-[28px] border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-montserrat text-[#0F172A] leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500">
                {description || "Smart Auto-Mapping CSV Importer for Google Forms & Excel Sheets"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sampleTemplateData && step === "upload" && (
              <button
                type="button"
                onClick={handleDownloadSample}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Template CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps Breadcrumb / Status Indicator */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1.5 ${step === "upload" ? "text-blue-600 font-bold" : "text-slate-400"}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">1</span>
              Upload File
            </span>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <span className={`flex items-center gap-1.5 ${step === "map" ? "text-blue-600 font-bold" : step === "preview" || step === "importing" ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">2</span>
              Map Columns
            </span>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <span className={`flex items-center gap-1.5 ${step === "preview" ? "text-blue-600 font-bold" : "text-slate-400"}`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-current">3</span>
              Preview & Import
            </span>
          </div>

          {file && step !== "importing" && (
            <button
              onClick={handleReset}
              className="text-[11px] text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Change File
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-[24px] p-8 text-center cursor-pointer transition-all duration-200 group flex flex-col items-center justify-center min-h-[260px]"
              >
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-[#0F172A] mb-1">
                  Drag and drop your CSV file here, or <span className="text-blue-600 underline">browse</span>
                </h4>
                <p className="text-xs text-slate-400 max-w-md">
                  Works seamlessly with Google Forms responses, Excel sheets, or custom CRM exports. Column names will be automatically matched.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Tips & Auto Detection Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-[20px] p-4 flex items-start gap-3 text-xs text-slate-600">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-slate-800 mb-0.5">Smart Column Matching Enabled</h5>
                  <p className="text-slate-500 leading-relaxed">
                    Extra form columns like <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">Timestamp</code>, <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">Full Name</code>, <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">Upload Photo</code>, <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">Facebook Profile URL</code>, or <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800">Department</code> will be recognized automatically on the next step.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === "map" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 border border-blue-100 p-4 rounded-[20px]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {rawRows.length}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-blue-900">
                      Detected {rawRows.length} Rows & {rawHeaders.length} Columns
                    </h5>
                    <p className="text-[11px] text-blue-700">
                      File: <span className="font-medium">{file?.name}</span>. Verify the column mappings below or adjust any field.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setColumnMapping(autoDetectMapping(rawHeaders))}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Auto-Detect Again
                </button>
              </div>

              {/* ID Auto Generation Control (if ID field is present) */}
              {idFieldKey && (
                <div className="bg-slate-50 border border-slate-200 rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Missing ID Auto-Generation</h5>
                      <p className="text-[11px] text-slate-500">
                        If a member does not have an ID in the CSV, automatically generate one (e.g. {idPrefixInput}21-001).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoGenerateId}
                        onChange={(e) => setAutoGenerateId(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>Auto-Generate</span>
                    </label>

                    {autoGenerateId && (
                      <input
                        type="text"
                        value={idPrefixInput}
                        onChange={(e) => setIdPrefixInput(e.target.value)}
                        placeholder="Prefix (e.g. MEM-)"
                        className="w-24 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 font-mono"
                        title="ID Prefix"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Mapping Grid */}
              <div className="border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
                <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="col-span-5 sm:col-span-4">CSV Column (From Form/Excel)</div>
                  <div className="col-span-4 sm:col-span-4">Sample Data</div>
                  <div className="col-span-3 sm:col-span-4">Map To System Field</div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {rawHeaders.map((header) => {
                    const mappedKey = columnMapping[header] || "__SKIP__";
                    const isSkipped = mappedKey === "__SKIP__";
                    const targetDef = targetFields.find(t => t.key === mappedKey);
                    const sampleValue = rawRows[0]?.[header] || rawRows[1]?.[header] || "(Empty)";

                    return (
                      <div
                        key={header}
                        className={`px-4 py-3 grid grid-cols-12 gap-2 items-center text-xs transition-colors ${
                          isSkipped ? "bg-slate-50/40 text-slate-400" : "bg-white text-slate-800"
                        }`}
                      >
                        {/* CSV Column Name */}
                        <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
                          <span className="font-bold font-mono text-[#0F172A] truncate" title={header}>
                            {header}
                          </span>
                          {header.toLowerCase().includes("timestamp") && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 rounded border border-amber-200">
                              Form Meta
                            </span>
                          )}
                        </div>

                        {/* Sample Value */}
                        <div className="col-span-4 sm:col-span-4 truncate text-slate-500 font-mono text-[11px]" title={sampleValue}>
                          {sampleValue}
                        </div>

                        {/* Map To Dropdown */}
                        <div className="col-span-3 sm:col-span-4">
                          <div className="relative">
                            <select
                              value={mappedKey}
                              onChange={(e) => {
                                const newKey = e.target.value;
                                setColumnMapping(prev => ({ ...prev, [header]: newKey }));
                              }}
                              className={`w-full appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-bold border transition-all outline-none ${
                                isSkipped
                                  ? "bg-slate-100 border-slate-200 text-slate-500"
                                  : targetDef?.required
                                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 focus:ring-2 focus:ring-emerald-500/20"
                                  : "bg-blue-50/80 border-blue-300 text-blue-800 focus:ring-2 focus:ring-blue-500/20"
                              }`}
                            >
                              <option value="__SKIP__">⛔ [ Skip / Ignore Column ]</option>
                              <optgroup label="System Fields">
                                {targetFields.map((field) => (
                                  <option key={field.key} value={field.key}>
                                    {field.required ? `★ ${field.label} (Required)` : field.label}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status summary of mapped fields */}
              <div className="flex flex-wrap gap-2 text-xs">
                {targetFields.map(field => {
                  const isMapped = Object.values(columnMapping).includes(field.key);
                  return (
                    <span
                      key={field.key}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border ${
                        isMapped
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : field.required
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isMapped ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : field.required ? (
                        <AlertCircle className="w-3 h-3 text-red-600" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      )}
                      {field.label} {field.required && !isMapped ? "(Required)" : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === "preview" && (
            <div className="space-y-5">
              {/* Validation Status Card */}
              <div className={`p-4 rounded-[20px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                validationSummary.isReady
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                  : "bg-amber-50/80 border-amber-200 text-amber-900"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    validationSummary.isReady ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                  }`}>
                    {validationSummary.isReady ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold">
                      {validationSummary.isReady
                        ? `Ready to Import All ${validationSummary.totalRows} Items!`
                        : `${validationSummary.invalidRows} of ${validationSummary.totalRows} items have missing required fields`}
                    </h5>
                    <p className="text-[11px] opacity-80">
                      {validationSummary.isReady
                        ? "Review the mapped preview table below. Click 'Start Import' to save."
                        : `Missing required: ${validationSummary.missingFields.join(", ")}. You can go back to map or proceed.`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold font-mono px-3 py-1 bg-white rounded-lg border border-current/20">
                    {validationSummary.validRows} / {validationSummary.totalRows} Ready
                  </span>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Live Preview (Showing first 5 of {mappedData.length} records)</span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">#</th>
                        {targetFields.filter(tf => Object.values(columnMapping).includes(tf.key) || tf.key === idFieldKey).map(f => (
                          <th key={f.key} className="p-3 font-mono whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-inter">
                      {mappedData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                          {targetFields.filter(tf => Object.values(columnMapping).includes(tf.key) || tf.key === idFieldKey).map(f => {
                            const val = row[f.key];
                            return (
                              <td key={f.key} className="p-3 text-slate-800 max-w-[200px] truncate" title={String(val || "")}>
                                {val ? (
                                  String(val)
                                ) : f.required ? (
                                  <span className="text-red-500 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                    Missing
                                  </span>
                                ) : (
                                  <span className="text-slate-300 italic">None</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING / RESULT */}
          {step === "importing" && (
            <div className="py-12 px-4 text-center space-y-5">
              {!importResult ? (
                <>
                  <div className="w-14 h-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto" />
                  <div>
                    <h4 className="text-base font-bold text-[#0F172A] mb-1">
                      Importing Records into Database...
                    </h4>
                    <p className="text-xs text-slate-500">
                      Writing batches to Firestore safely without limits. Please do not close this window.
                    </p>
                  </div>
                </>
              ) : importResult.success ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold font-montserrat text-[#0F172A] mb-1">
                      Import Completed Successfully!
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {importResult.message}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold font-montserrat text-red-700 mb-1">
                      Import Failed
                    </h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      {importResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            {step === "map" && (
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Back to Upload
              </button>
            )}
            {step === "preview" && (
              <button
                type="button"
                onClick={() => setStep("map")}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Back to Column Mapping
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step !== "importing" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-[16px] bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>

                {step === "map" && (
                  <button
                    type="button"
                    onClick={() => setStep("preview")}
                    className="px-6 py-2.5 rounded-[16px] bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1.5 hover:scale-[1.02]"
                  >
                    Next: Preview <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === "preview" && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-6 py-2.5 rounded-[16px] bg-emerald-600 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1.5 hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Start Import ({mappedData.length} Items)
                  </button>
                )}
              </>
            ) : importResult ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  handleReset();
                }}
                className="px-6 py-2.5 rounded-[16px] bg-[#0F172A] text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all"
              >
                Done & Close
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}
