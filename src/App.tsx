import React, { useState, useEffect } from 'react';
import { 
  Link2, MousePointerClick, Copy, Trash2, Calendar, 
  Lock, Eye, AlertCircle, Key, RefreshCw, BarChart3, 
  ExternalLink, Search, Sparkles, Smartphone, Laptop, 
  Compass, Shield, UserCheck, HelpCircle, ArrowUpRight, 
  Download, Globe, Check
} from 'lucide-react';
import { ShortLink, ClickEvent, DashboardStats } from './types';
import LinkCreateForm from './components/LinkCreateForm';

export default function App() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null);
  const [selectedLinkClicks, setSelectedLinkClicks] = useState<ClickEvent[]>([]);
  const [selectedLinkLoading, setSelectedLinkLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch all link entries & general statistics on load
  const fetchDashboardData = async () => {
    try {
      setLoadingLinks(true);
      // Fetch links
      const lRes = await fetch('/api/links');
      const lData = await lRes.json();
      if (lData.success) {
        setLinks(lData.links);
        // Default select first link if none chosen yet
        if (lData.links.length > 0 && !selectedLink) {
          fetchLinkAnalytics(lData.links[0]);
        }
      }

      // Fetch general stats
      const sRes = await fetch('/api/dashboard/metrics');
      const sData = await sRes.json();
      if (sData.success) {
        setDashboardStats(sData.stats);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch detailed analytics for a single chosen link
  const fetchLinkAnalytics = async (link: ShortLink) => {
    setSelectedLink(link);
    setSelectedLinkLoading(true);
    try {
      const res = await fetch(`/api/links/${link.shortId}/analytics`);
      const data = await res.json();
      if (data.success) {
        setSelectedLinkClicks(data.clicks);
      }
    } catch (err) {
      console.error('Error loading link analytics:', err);
    } finally {
      setSelectedLinkLoading(false);
    }
  };

  // Delete option
  const handleDeleteLink = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الرابط والولوج لإحصائياته بشكل نهائي؟')) {
      return;
    }

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        // Remove from UI
        setLinks(prev => prev.filter(l => l.id !== id));
        if (selectedLink && selectedLink.id === id) {
          setSelectedLink(null);
          setSelectedLinkClicks([]);
        }
        // Refresh metrics
        const sRes = await fetch('/api/dashboard/metrics');
        const sData = await sRes.json();
        if (sData.success) {
          setDashboardStats(sData.stats);
        }
      }
    } catch (err) {
      console.error('Error deleting link:', err);
    }
  };

  const handleCopyLink = (shortId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const shortUrl = `${window.location.origin}/r/${shortId}`;
    navigator.clipboard.writeText(shortUrl);
    setCopiedId(shortId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Helper calculation for custom referrers, browsers, and devices percentages inside interactive selected block
  const computeClickAnalytics = () => {
    const devices = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
    const browsers: Record<string, number> = {};
    const OSs: Record<string, number> = {};
    const pathReferrers: Record<string, number> = {};

    selectedLinkClicks.forEach(c => {
      // Device
      if (c.device in devices) {
        devices[c.device as keyof typeof devices]++;
      } else {
        devices.unknown++;
      }

      // Browser
      browsers[c.browser] = (browsers[c.browser] || 0) + 1;

      // OS
      OSs[c.os] = (OSs[c.os] || 0) + 1;

      // Referrer
      let refLabel = 'مباشر / غير معروف';
      if (c.referer && c.referer !== 'Direct / Bookmark') {
        try {
          const url = new URL(c.referer);
          refLabel = url.hostname;
          if (refLabel.includes('t.me') || refLabel.includes('telegram')) refLabel = 'تليجرام (Telegram)';
          else if (refLabel.includes('wa.me') || refLabel.includes('whatsapp')) refLabel = 'واتساب (WhatsApp)';
          else if (refLabel.includes('facebook') || refLabel.includes('fb.com')) refLabel = 'فيسبوك (Facebook)';
          else if (refLabel.includes('twitter') || refLabel.includes('x.com')) refLabel = 'منصة X';
          else if (refLabel.includes('linkedin')) refLabel = 'لينكد إن';
        } catch {
          refLabel = c.referer;
        }
      }
      pathReferrers[refLabel] = (pathReferrers[refLabel] || 0) + 1;
    });

    const total = selectedLinkClicks.length || 1;

    // Map to simple lists with weights/percentages
    const formatPercent = (val: number) => Math.round((val / total) * 100);

    return {
      devicesList: [
        { name: 'حاسوب ومكتبي', value: devices.desktop, percentage: formatPercent(devices.desktop) },
        { name: 'هواتف ذكية', value: devices.mobile, percentage: formatPercent(devices.mobile) },
        { name: 'أجهزة لوحية', value: devices.tablet, percentage: formatPercent(devices.tablet) },
      ].filter(d => d.value > 0),
      browsersList: Object.entries(browsers).map(([name, val]) => ({
        name, value: val, percentage: formatPercent(val)
      })).sort((a,b) => b.value - a.value),
      referrersList: Object.entries(pathReferrers).map(([name, val]) => ({
        name, value: val, percentage: formatPercent(val)
      })).sort((a,b) => b.value - a.value)
    };
  };

  const { devicesList, browsersList, referrersList } = computeClickAnalytics();

  // Filter links for search
  const filteredLinks = links.filter(l => {
    const term = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      l.shortId.toLowerCase().includes(term) ||
      l.originalUrl.toLowerCase().includes(term) ||
      l.driveType.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Navigation Topbar */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-0 z-55 px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-blue-500/20">
            D
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800 underline decoration-blue-500 decoration-3 underline-offset-4 flex items-center gap-2">
              مختصر ومتبع روابط Google Drive
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-normal border border-blue-100">نظام ذكي</span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">تقصير الروابط بنقرة واحدة، تحويل التصدير التلقائي وتتبع جودة النقرات في لوحة غنية</p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs font-semibold text-slate-500">
          <a href="#link-create-container" className="hover:text-blue-600 transition">إنشاء رابط مختصر</a>
          <a href="#all-links-section" className="hover:text-blue-600 transition">روابطي المخزنة</a>
          <a href="#analytics-section" className="hover:text-blue-600 transition">تحليل النقرات المتقدم</a>
        </div>

        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-full px-3 text-xs text-slate-600 border border-slate-200/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>حالة النظام: متصل بالخادم</span>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">مجموع الروابط المختصرة</p>
              <h3 className="text-2xl font-black text-slate-800 mt-0.5">{dashboardStats?.totalLinks ?? links.length}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MousePointerClick className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium font-sans">إجمالي النقرات المستلمة</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                {dashboardStats?.totalClicks ?? links.reduce((sum, current) => sum + current.clickCount, 0)}
              </h3>
            </div>
          </div>

          {/* Drive specific type counters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">مستندات وجداول بيانات</p>
              <h3 className="text-2xl font-black text-slate-800 mt-0.5">
                {(dashboardStats?.driveTypesCount.document || 0) + (dashboardStats?.driveTypesCount.spreadsheet || 0)}
              </h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">الروابط النشطة</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                {links.filter(l => {
                  if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return false;
                  if (l.clickLimit && l.clickCount >= l.clickLimit) return false;
                  return true;
                }).length}
              </h3>
            </div>
          </div>
        </div>

        {/* Create Short Link Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <LinkCreateForm onLinkCreated={fetchDashboardData} />
            
            {/* Direct Google Drive File URL Converter Helper card */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 translate-x-[-15%] translate-y-[-10%] w-40 h-40 rounded-full bg-blue-500/10 blur-[40px] pointer-events-none"></div>
              <div>
                <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> دليل تحويل روابط درايف الفوري
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  هل ترغب في تحويل مستندات وملفات Google Drive إلى تنزيلات مباشرة للزوار؟ يقوم الخادم بتحليل روابطك وتغييرها ديناميكياً عند النقر لتبدأ عملية تحميل الملفات مباشرة بدلاً من عرض صفحة المعاينة الكبيرة في المتصفح.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
                <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                  <div className="font-bold text-slate-200">تحويل كـ PDF فوري</div>
                  <div className="text-slate-400/80">لمستندات Google Docs وجداول البيانات والعروض.</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                  <div className="font-bold text-slate-200">صيغة MS Office</div>
                  <div className="text-slate-400/80">للإصلاح الذاتي مباشرة كملفات .docx أو .xlsx.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Last links list styled table */}
          <div id="all-links-section" className="lg:col-span-6 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">الروابط المختصرة النشطة والمحفوظة</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">انقر على أي رابط من القائمة لاستعراض تقرير النقر التفصيلي والبلدان المنشأ</p>
                </div>
                <button 
                  onClick={fetchDashboardData}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> تحديث البيانات
                </button>
              </div>

              {/* Search links bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، الكود المخصص، أو الرابط الأصلي..."
                  className="w-full pl-4 pr-10 py-2.5 bg-white text-xs text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-100 transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Links list container */}
              <div className="flex-1 overflow-y-auto max-h-[480px]">
                {loadingLinks ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-xs">جاري تحميل الروابط...</span>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center px-4">
                    <Link2 className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-600">لا توجد روابط مطابقة للبحث</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[280px]">قم بإدخال أول رابط Google Drive بالأعلى واشترك في تقصير المسار!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredLinks.map((link) => {
                      const isExpired = link.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
                      const isLimitReached = link.clickLimit && link.clickCount >= link.clickLimit;
                      const isSelected = selectedLink?.id === link.id;

                      let statusBadge = (
                        <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">نشط</span>
                      );
                      if (isExpired) {
                        statusBadge = (
                          <span className="inline-flex items-center text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-bold">منتهي الصلاحية</span>
                        );
                      } else if (isLimitReached) {
                        statusBadge = (
                          <span className="inline-flex items-center text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold">تم بلوغ الحد المسموح</span>
                        );
                      }

                      return (
                        <div
                          key={link.id}
                          onClick={() => fetchLinkAnalytics(link)}
                          className={`p-4 hover:bg-slate-50/70 transition cursor-pointer flex flex-col gap-2 relative ${isSelected ? 'bg-blue-50/40 border-r-4 border-r-blue-600' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-slate-800 line-clamp-1 flex-1 leading-tight">{link.title}</h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {link.password && <Lock className="w-3.5 h-3.5 text-indigo-500" title="محمي بكلمة مرور" />}
                              {statusBadge}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            {/* Shortened URL Copy target */}
                            <span className="font-mono text-blue-600 font-semibold dir-ltr flex items-center gap-1 hover:underline">
                              /r/{link.shortId}
                              <ArrowUpRight className="w-3 h-3" />
                            </span>
                            
                            {/* Original URL description */}
                            <span className="truncate max-w-[150px] sm:max-w-[200px] text-left block text-slate-400 dir-ltr">{link.originalUrl}</span>
                          </div>

                          {/* Action Button Strip */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {link.clickCount} نقرة
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {link.exportType === 'pdf' && 'تصدير PDF'}
                                {link.exportType === 'direct' && 'تحميل مباشر'}
                                {link.exportType === 'office' && 'تحويل Office'}
                                {link.exportType === 'redirect' && 'عرض فقط'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Copy Short Url */}
                              <button
                                onClick={(e) => handleCopyLink(link.shortId, e)}
                                className="p-1 px-2.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white transition text-[10px] font-bold flex items-center gap-1 text-slate-600"
                                title="نسخ الرابط المصغر"
                              >
                                {copiedId === link.shortId ? (
                                  <>
                                    <Check className="w-3 h-3" /> تم النسخ
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> نسخ
                                  </>
                                )}
                              </button>

                              <a
                                href={`/r/${link.shortId}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 transition text-slate-600"
                                title="فتح ومعاينة التحويل"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>

                              <button
                                onClick={(e) => handleDeleteLink(link.id, e)}
                                className="p-1 rounded bg-red-50 hover:bg-red-200 text-red-500 transition"
                                title="حذف بالكامل"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Link Analytics Display Dashboard Section */}
        <div id="analytics-section" className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
          <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" /> لوحة البيانات والتحليل المتقدم للنقرات
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">تحليل مفصل فوري للأجهزة، المتصفحات، وأنظمة التشغيل للملفات المشتركة</p>
            </div>

            {selectedLink && (
              <div className="bg-slate-100/80 rounded-xl px-4 py-2.5 text-xs flex items-center gap-1.5 border border-slate-200/40">
                <span className="font-bold text-slate-700">الملف المحدد:</span>
                <span className="font-semibold text-blue-700 max-w-[180px] truncate">{selectedLink.title}</span>
                <span className="font-mono text-slate-400 text-[10px] bg-white px-1.5 py-0.5 border border-slate-200/50 rounded flex items-center gap-0.5">
                  /r/{selectedLink.shortId}
                </span>
              </div>
            )}
          </div>

          {!selectedLink ? (
            <div className="text-center py-20 text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-sm font-bold text-slate-600">لم يتم تحديد أي ملف للاستعراض</p>
              <p className="text-xs text-slate-400 mt-1">اختر أحد الروابط المختصرة من القائمة لاستعراض رسومات نقرات الزوار ومصادرهم</p>
            </div>
          ) : selectedLinkLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs">جاري تحليل وحساب النقرات...</span>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Detailed Link Configuration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">مسار التحويل الفعلي</span>
                  <div className="text-sm font-bold text-slate-800 mt-1 truncate dir-ltr text-right">{selectedLink.originalUrl}</div>
                  <a 
                    href={selectedLink.originalUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] text-blue-600 font-bold hover:underline inline-flex items-center gap-1 mt-2"
                  >
                    فتح رابط درايف مباشرة <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">سجل تاريخ الاختصار</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {new Date(selectedLink.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">الساعة {new Date(selectedLink.createdAt).toLocaleTimeString('ar-EG')}</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">حالة حماية الولوج والقيود</span>
                    <div className="flex items-center gap-2 mt-1.5">
                      {selectedLink.password ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] border border-indigo-100 font-semibold">
                          <Lock className="w-3 h-3" /> يطلب كلمة مرور
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] border border-slate-200 font-semibold">
                          <Globe className="w-3 h-3" /> بدون قيود معقدة
                        </span>
                      )}

                      {selectedLink.clickLimit && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] border border-amber-100 font-semibold">
                          حد {selectedLink.clickLimit} نقرة
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Click volume counter display */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/70 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {selectedLinkClicks.length}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">إجمالي النقرات المدرجة في التحليل</p>
                    <p className="text-[11px] text-slate-400">تحديث فوري لكل معاملة تتم عبر المتصفحات</p>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  {selectedLinkClicks.length > 0 ? (
                    <span>آخر نقرة: {new Date(selectedLinkClicks[selectedLinkClicks.length - 1].timestamp).toLocaleDateString('ar-EG')}</span>
                  ) : (
                    <span>لا توجد زيارات مسجلة حتى الآن</span>
                  )}
                </div>
              </div>

              {selectedLinkClicks.length === 0 ? (
                <div className="p-10 border border-dashed border-slate-200/80 rounded-xl text-center text-slate-400">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                  <p className="text-xs font-bold text-slate-600">بانتظار النقرة الأولى</p>
                  <p className="text-[10px] text-slate-400 mt-1">انسخ رابط التحويل المصغر وشاركه مع زملائك أو زوارك لمشاهدة ظهور الإحصائيات هنا فوراً!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Traffic Referrers bar distribution */}
                  <div className="bg-slate-50/50 rounded-xl border border-slate-200/50 p-5">
                    <h4 className="text-xs font-extrabold text-slate-700 mb-4 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-blue-600" /> أكثر مصادر الإحالة والزيارات
                    </h4>
                    
                    <div className="space-y-4">
                      {referrersList.map((ref, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                            <span className="truncate max-w-[170px]">{ref.name}</span>
                            <span>{ref.percentage}% ({ref.value})</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${ref.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Browser distribution */}
                  <div className="bg-slate-50/50 rounded-xl border border-slate-200/50 p-5">
                    <h4 className="text-xs font-extrabold text-slate-700 mb-4 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-indigo-600" /> المتصفحات المستخدمة (Browser)
                    </h4>

                    <div className="space-y-4">
                      {browsersList.map((browser, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                            <span>{browser.name}</span>
                            <span>{browser.percentage}% ({browser.value})</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${browser.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Devices & Clients distribution */}
                  <div className="bg-slate-50/50 rounded-xl border border-slate-200/50 p-5">
                    <h4 className="text-xs font-extrabold text-slate-700 mb-4 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-purple-600" /> خريطة الأجهزة والمنصات (Devices)
                    </h4>

                    <div className="space-y-4">
                      {devicesList.map((device, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                            <span>{device.name}</span>
                            <span>{device.percentage}% ({device.value})</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-purple-600 h-full rounded-full transition-all duration-300" style={{ width: `${device.percentage}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Individual raw historical click table log */}
              {selectedLinkClicks.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-extrabold text-slate-700 mb-2.5">سجل الزيارات الفردية الأخير (أحدث 15 زيارة)</h4>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white text-xs">
                    <table className="w-full text-right table-auto">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-3 font-semibold">التوقيت والتاريخ</th>
                          <th className="px-4 py-3 font-semibold">المتصفح والنظام</th>
                          <th className="px-4 py-3 font-semibold">الجهاز</th>
                          <th className="px-4 py-3 font-semibold">البلد المستنتج</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {selectedLinkClicks.slice(-15).reverse().map((click) => (
                          <tr key={click.id} className="hover:bg-slate-50/40">
                            <td className="px-4 py-3 text-slate-600 font-normal">
                              {new Date(click.timestamp).toLocaleString('ar-EG')}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {click.browser} ({click.os})
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-500">
                              {click.device === 'mobile' ? 'هاتف ذكي' : click.device === 'tablet' ? 'لوحي' : 'جهاز مكتبي'}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {click.country ? click.country : 'افتراضي / محلي'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modern elegant footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-600">D</span>
            <span>مختصر ومتبع روابط Google Drive &copy; 2026</span>
          </div>
          <span className="text-slate-400">تصميم نظيف وعالي الجودة، جاهز للاستضافة على GitHub</span>
        </div>
      </footer>
    </div>
  );
}
