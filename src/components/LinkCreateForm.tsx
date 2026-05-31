import React, { useState, useEffect } from 'react';
import { 
  Link2, Sparkles, Loader2, Lock, Calendar, 
  MousePointerClick, Settings, AlertCircle, FileText, 
  FileSpreadsheet, Play, Folder, File, Globe, Check
} from 'lucide-react';
import { DriveType, ExportType, ShortLink } from '../types';

interface LinkCreateFormProps {
  onLinkCreated: (link: ShortLink) => void;
}

export default function LinkCreateForm({ onLinkCreated }: LinkCreateFormProps) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [exportType, setExportType] = useState<ExportType>('redirect');
  const [customCode, setCustomCode] = useState('');
  const [password, setPassword] = useState('');
  const [clickLimit, setClickLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-detect URL properties
  const [detectedType, setDetectedType] = useState<DriveType>('generic');

  useEffect(() => {
    if (!originalUrl) {
      setDetectedType('generic');
      return;
    }

    try {
      const parsed = new URL(originalUrl);
      const host = parsed.hostname;
      const path = parsed.pathname;

      if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
        if (path.includes('/spreadsheets/d/')) {
          setDetectedType('spreadsheet');
        } else if (path.includes('/document/d/')) {
          setDetectedType('document');
        } else if (path.includes('/presentation/d/')) {
          setDetectedType('presentation');
        } else if (path.includes('/folders/')) {
          setDetectedType('folder');
        } else if (path.includes('/file/d/') || path.includes('/open')) {
          setDetectedType('file');
        } else {
          setDetectedType('generic');
        }
      } else {
        setDetectedType('generic');
      }
    } catch {
      setDetectedType('generic');
    }
  }, [originalUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!originalUrl) {
      setError('يرجى إدخال الرابط المراد تقصيره.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalUrl,
          title: title.trim() || undefined,
          exportType,
          customCode: customCode.trim() || undefined,
          password: password.trim() || undefined,
          clickLimit: clickLimit ? parseInt(clickLimit, 10) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية تقصير الرابط.');
      }

      onLinkCreated(data.link);
      setSuccessMsg('تم تقصير الاختصار بنجاح!');
      
      // Reset form
      setOriginalUrl('');
      setTitle('');
      setExportType('redirect');
      setCustomCode('');
      setPassword('');
      setClickLimit('');
      setExpiresAt('');
      setShowAdvanced(false);

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الشبكة.');
    } finally {
      setLoading(false);
    }
  };

  const getDriveBadge = () => {
    switch (detectedType) {
      case 'document':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
            <FileText className="w-3.5 h-3.5" /> مستند Google Docs
          </span>
        );
      case 'spreadsheet':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
            <FileSpreadsheet className="w-3.5 h-3.5" /> جدول بيانات Google Sheets
          </span>
        );
      case 'presentation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
            <Play className="w-3.5 h-3.5" /> عرض تقديمي Google Slides
          </span>
        );
      case 'folder':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Folder className="w-3.5 h-3.5" /> مجلد Google Drive
          </span>
        );
      case 'file':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-100">
            <File className="w-3.5 h-3.5" /> ملف Google Drive عامّ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
            <Globe className="w-3.5 h-3.5" /> رابط ويب عامّ
          </span>
        );
    }
  };

  return (
    <div id="link-create-container" className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Link2 className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">تقصير وتخصيص رابط جديد</h2>
          <p className="text-xs text-slate-400 mt-0.5">يدعم روابط Google Drive ومستنداته مع خيارات تصدير ذكية</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* originalUrl */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">أدخل رابط Google Drive الأصلي <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type="text"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/... أو أي رابط ويب آخر"
              className="w-full pl-4 pr-11 py-3 bg-slate-50 hover:bg-slate-50/50 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-150 text-sm dir-ltr text-right"
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Link2 className="w-5 h-5" />
            </div>
          </div>
          {originalUrl && (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">نوع الرابط المُكتشف:</span>
              {getDriveBadge()}
            </div>
          )}
        </div>

        {/* title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان مخصص للاختصار (اختياري)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: التقرير السنوي 2026 أو مجلد الصور المشترك"
            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-50/50 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-150 text-sm"
          />
        </div>

        {/* Custom Actions for google drive */}
        {detectedType !== 'generic' && (
          <div className="bg-blue-50/40 rounded-xl border border-blue-50/80 p-4 mt-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 mb-3 bg-blue-100/50 px-2.5 py-1 rounded-md">
              <Sparkles className="w-3.5 h-3.5" /> ميزات ذكية لـ Google Drive
            </span>
            <label className="block text-sm font-bold text-slate-700 mb-2">إجراء التحويل وتوجيه الزوار:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition ${exportType === 'redirect' ? 'bg-white border-blue-500 shadow-sm' : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                  <input
                    type="radio"
                    name="exportType"
                    checked={exportType === 'redirect'}
                    onChange={() => setExportType('redirect')}
                    className="accent-blue-600"
                  />
                  المعاينة الافتراضية
                </div>
                <span className="text-[10px] text-slate-400 mt-1">توجيه إلى المعاينة المعتادة لـ Google Drive في المتصفح</span>
              </label>

              {(detectedType === 'file') && (
                <label className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition ${exportType === 'direct' ? 'bg-white border-blue-500 shadow-sm' : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                    <input
                      type="radio"
                      name="exportType"
                      checked={exportType === 'direct'}
                      onChange={() => setExportType('direct')}
                      className="accent-blue-600"
                    />
                    رابط تحميل مباشر
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">يبدأ فوراً بتحميل الملف مباشرة متخطياً واجهة العرض</span>
                </label>
              )}

              {(detectedType === 'document' || detectedType === 'spreadsheet' || detectedType === 'presentation') && (
                <>
                  <label className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition ${exportType === 'pdf' ? 'bg-white border-blue-500 shadow-sm' : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                      <input
                        type="radio"
                        name="exportType"
                        checked={exportType === 'pdf'}
                        onChange={() => setExportType('pdf')}
                        className="accent-blue-600"
                      />
                      تحميل مباشر كـ PDF
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">تصدير المستند تلقائياً إلى صيغة PDF وبدء تنزيله</span>
                  </label>

                  <label className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition ${exportType === 'office' ? 'bg-white border-blue-500 shadow-sm' : 'bg-slate-50/60 border-slate-200/60 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
                      <input
                        type="radio"
                        name="exportType"
                        checked={exportType === 'office'}
                        onChange={() => setExportType('office')}
                        className="accent-blue-600"
                      />
                      تصدير كـ Office (MS Word/Excel)
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">تنزيل بصيغة DOCX أو XLSX أو PPTX للمايكروسوفت أوفيس</span>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Custom Code */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">تخصيص مسار الرابط (Custom Slug)</label>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
            <span className="bg-slate-100 text-slate-500 px-4 flex items-center text-xs font-mono select-none dir-ltr">
              /r/
            </span>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
              placeholder="مثال: report-2026"
              className="flex-1 px-4 py-3 bg-white text-slate-800 placeholder-slate-400 border-none outline-none text-sm text-left font-mono dir-ltr"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">الأرقام، الحروف، (-) و (_) مسموح بها. حد أدنى 3 خانات.</p>
        </div>

        {/* Toggle options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            {showAdvanced ? 'إخفاء الإعدادات المتقدمة' : 'عرض إعدادات الحماية والقيود'}
          </button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" /> حماية بكلمة مرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full px-3 py-2 bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Click limit */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3 text-slate-400" /> حد النقرات (الزيارات)
              </label>
              <input
                type="number"
                min="1"
                value={clickLimit}
                onChange={(e) => setClickLimit(e.target.value)}
                placeholder="مثال: 50"
                className="w-full px-3 py-2 bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Expiry date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> تاريخ انتهاء الصلاحية
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Errors / Success alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري تقصير الرابط...
            </>
          ) : (
            <>
              تقصير الرابط وحفظ الإحصائيات
            </>
          )}
        </button>
      </form>
    </div>
  );
}
