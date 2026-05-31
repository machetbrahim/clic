import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  getLinks, 
  getLinkByShortId, 
  addLink, 
  deleteLink, 
  addClick, 
  getClicksForLink, 
  getAllClicks 
} from './server/db';
import { ShortLink, ClickEvent, DriveType, ExportType } from './src/types';

const PORT = 3000;

// Simple custom characters for random IDs (excluding ambiguous chars like 0, O, I, l)
const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateShortId(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

// Google Drive URL Parser helper
function parseDriveUrl(url: string): { id: string; type: DriveType } {
  let id = '';
  let type: DriveType = 'generic';

  try {
    const checkUrl = new URL(url);
    const host = checkUrl.hostname;
    const path = checkUrl.pathname;

    if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
      // 1. Spreadsheet
      if (path.includes('/spreadsheets/d/')) {
        const match = path.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          id = match[1];
          type = 'spreadsheet';
        }
      }
      // 2. Document
      else if (path.includes('/document/d/')) {
        const match = path.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          id = match[1];
          type = 'document';
        }
      }
      // 3. Presentation
      else if (path.includes('/presentation/d/')) {
        const match = path.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          id = match[1];
          type = 'presentation';
        }
      }
      // 4. Folder
      else if (path.includes('/folders/')) {
        const match = path.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        if (match) {
          id = match[1];
          type = 'folder';
        }
      } else if (path.includes('/folderview')) {
        const folderId = checkUrl.searchParams.get('id');
        if (folderId) {
          id = folderId;
          type = 'folder';
        }
      }
      // 5. General file link
      else if (path.includes('/file/d/')) {
        const match = path.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          id = match[1];
          type = 'file';
        }
      }
      // 6. open?id=xxx
      else if (path.endsWith('/open') || path.includes('/open')) {
        const fileId = checkUrl.searchParams.get('id');
        if (fileId) {
          id = fileId;
          type = 'file';
        }
      }
    }
  } catch (e) {
    // Non-URL input or invalid URL
  }

  return { id, type };
}

// Build optimized destination URL depending on format and conversion type
function buildRedirectionUrl(originalUrl: string, driveId: string, driveType: DriveType, exportType: ExportType): string {
  if (!driveId || driveType === 'generic') {
    return originalUrl;
  }

  // If redirect export mode, keep original link
  if (exportType === 'redirect') {
    return originalUrl;
  }

  switch (driveType) {
    case 'file':
      if (exportType === 'direct') {
        return `https://drive.google.com/uc?export=download&id=${driveId}`;
      }
      break;

    case 'document':
      if (exportType === 'direct' || exportType === 'office') {
        return `https://docs.google.com/document/d/${driveId}/export?format=docx`;
      } else if (exportType === 'pdf') {
        return `https://docs.google.com/document/d/${driveId}/export?format=pdf`;
      }
      break;

    case 'spreadsheet':
      if (exportType === 'direct' || exportType === 'office') {
        return `https://docs.google.com/spreadsheets/d/${driveId}/export?format=xlsx`;
      } else if (exportType === 'pdf') {
        return `https://docs.google.com/spreadsheets/d/${driveId}/export?format=pdf`;
      }
      break;

    case 'presentation':
      if (exportType === 'direct' || exportType === 'office') {
        return `https://docs.google.com/presentation/d/${driveId}/export?format=pptx`;
      } else if (exportType === 'pdf') {
        return `https://docs.google.com/presentation/d/${driveId}/export?format=pdf`;
      }
      break;

    default:
      break;
  }

  return originalUrl;
}

// User agent analytics parser
function parseUserAgent(uaString: string = ''): { browser: string; os: string; device: 'desktop' | 'tablet' | 'mobile' | 'unknown' } {
  let browser = 'Other';
  let os = 'Other';
  let device: 'desktop' | 'tablet' | 'mobile' | 'unknown' = 'desktop';

  // Device type estimation
  if (/mobi|android|iphone|ipod/i.test(uaString)) {
    device = 'mobile';
  } else if (/ipad|tablet/i.test(uaString)) {
    device = 'tablet';
  }

  // OS detection
  if (/windows/i.test(uaString)) {
    os = 'Windows';
  } else if (/macintosh|mac os/i.test(uaString)) {
    if (/iphone|ipad/i.test(uaString)) {
      os = 'iOS';
    } else {
      os = 'macOS';
    }
  } else if (/android/i.test(uaString)) {
    os = 'Android';
  } else if (/linux/i.test(uaString)) {
    os = 'Linux';
  }

  // Browser detection
  if (/edg/i.test(uaString)) {
    browser = 'Edge';
  } else if (/chrome|crios/i.test(uaString)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(uaString)) {
    browser = 'Firefox';
  } else if (/safari/i.test(uaString)) {
    browser = 'Safari';
  }

  return { browser, os, device };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API - Get all short links with their statistics
  app.get('/api/links', (req, res) => {
    try {
      const links = getLinks();
      res.json({ success: true, links });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Create short link
  app.post('/api/shorten', (req, res) => {
    try {
      const { 
        originalUrl, 
        title, 
        exportType = 'redirect', 
        password, 
        clickLimit, 
        expiresAt, 
        customCode 
      } = req.body;

      if (!originalUrl) {
        return res.status(400).json({ success: false, error: 'originalUrl is required' });
      }

      // Parse URL
      const { id: driveId, type: driveType } = parseDriveUrl(originalUrl);

      // Validate custom code if provided
      let finalShortId = '';
      if (customCode && customCode.trim()) {
        const sanitizedCode = customCode.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        if (sanitizedCode.length < 3) {
          return res.status(400).json({ success: false, error: 'Custom code must be at least 3 characters long' });
        }
        
        // Check uniqueness
        const existing = getLinkByShortId(sanitizedCode);
        if (existing) {
          return res.status(400).json({ success: false, error: 'Custom code is already in use' });
        }
        finalShortId = sanitizedCode;
      } else {
        // Generate a standard unique shortId
        let attempts = 0;
        do {
          finalShortId = generateShortId();
          attempts++;
        } while (getLinkByShortId(finalShortId) && attempts < 10);
      }

      const cleanTitle = title || (driveType !== 'generic' ? `Google Drive - ${driveType.charAt(0).toUpperCase() + driveType.slice(1)}` : 'Custom Link');

      const newLink: ShortLink = {
        id: Math.random().toString(36).substring(2, 11),
        originalUrl,
        shortId: finalShortId,
        title: cleanTitle,
        driveType,
        exportType,
        createdAt: Date.now(),
        clickCount: 0,
        password: password || undefined,
        clickLimit: clickLimit ? parseInt(clickLimit, 10) : undefined,
        expiresAt: expiresAt || undefined
      };

      addLink(newLink);
      res.status(201).json({ success: true, link: newLink });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Get one link + full analytics click details
  app.get('/api/links/:code/analytics', (req, res) => {
    try {
      const code = req.params.code;
      const link = getLinkByShortId(code);
      if (!link) {
        return res.status(404).json({ success: false, error: 'Link not found' });
      }

      const clicks = getClicksForLink(link.id);
      res.json({ success: true, link, clicks });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Delete short link
  app.delete('/api/links/:id', (req, res) => {
    try {
      const id = req.params.id;
      const success = deleteLink(id);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Link not found' });
      }
      res.json({ success: true, message: 'Link deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API - Summary metrics dashboard data
  app.get('/api/dashboard/metrics', (req, res) => {
    try {
      const links = getLinks();
      const clicks = getAllClicks();

      // Drive Types Aggregations
      const driveTypesCount: Record<DriveType, number> = {
        document: 0,
        spreadsheet: 0,
        presentation: 0,
        folder: 0,
        file: 0,
        generic: 0
      };

      links.forEach(l => {
        if (driveTypesCount[l.driveType] !== undefined) {
          driveTypesCount[l.driveType]++;
        } else {
          driveTypesCount.generic++;
        }
      });

      // Export Types Aggregations
      const exportTypesCount: Record<ExportType, number> = {
        redirect: 0,
        direct: 0,
        pdf: 0,
        office: 0
      };

      links.forEach(l => {
        if (exportTypesCount[l.exportType] !== undefined) {
          exportTypesCount[l.exportType]++;
        }
      });

      // Clicks Over Time (last 7 days helper)
      const last7Days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
      }

      const clicksOverTimeMap = new Map<string, number>();
      last7Days.forEach(day => clicksOverTimeMap.set(day, 0));

      clicks.forEach(c => {
        const dateStr = new Date(c.timestamp).toISOString().split('T')[0];
        if (clicksOverTimeMap.has(dateStr)) {
          clicksOverTimeMap.set(dateStr, (clicksOverTimeMap.get(dateStr) || 0) + 1);
        }
      });

      const clicksOverTime = Array.from(clicksOverTimeMap.entries()).map(([date, count]) => ({
        date,
        clicks: count
      }));

      // Device Aggregations
      const devicesMap: Record<string, number> = { desktop: 0, tablet: 0, mobile: 0, unknown: 0 };
      clicks.forEach(c => {
        devicesMap[c.device] = (devicesMap[c.device] || 0) + 1;
      });

      const devicesCount = Object.entries(devicesMap)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

      // Browser Aggregations
      const browsersMap: Record<string, number> = {};
      clicks.forEach(c => {
        browsersMap[c.browser] = (browsersMap[c.browser] || 0) + 1;
      });

      const browsersCount = Object.entries(browsersMap).map(([name, value]) => ({ name, value }));

      res.json({
        success: true,
        stats: {
          totalLinks: links.length,
          totalClicks: clicks.length,
          driveTypesCount,
          exportTypesCount,
          clicksOverTime,
          devicesCount,
          browsersCount
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Short Code Redirection Router
  app.get('/r/:code', (req, res) => {
    try {
      const code = req.params.code;
      const link = getLinkByShortId(code);

      if (!link) {
        return res.status(404).send(`
          <html>
            <head>
              <title>الرابط غير موجود</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <script src="https://cdn.tailwindcss.com"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
            </head>
            <body class="bg-slate-50 text-slate-800 flex items-center justify-center min-h-screen" style="font-family: 'Inter', sans-serif;">
              <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-500 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 class="text-xl font-semibold text-slate-900 mb-2">عذراً، الرابط غير موجود!</h1>
                <p class="text-slate-500 mb-6 text-sm">الرمز الذي تحاول الوصول إليه غير صالح أو تم حذفه من قِبل المالك.</p>
                <a href="/" class="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-transparent rounded-lg font-medium text-sm transition shadow-sm">العودة للرئيسية</a>
              </div>
            </body>
          </html>
        `);
      }

      // Check Expiration
      if (link.expiresAt) {
        const expDate = new Date(link.expiresAt);
        if (expDate.getTime() < Date.now()) {
          return res.status(410).send(`
            <html>
              <head>
                <title>رابط منتهي الصلاحية</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
              </head>
              <body class="bg-slate-50 text-slate-800 flex items-center justify-center min-h-screen" style="font-family: 'Inter', sans-serif;">
                <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                  <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-500 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h1 class="text-xl font-semibold text-slate-900 mb-2">الرابط منتهي الصلاحية!</h1>
                  <p class="text-slate-500 mb-6 text-sm">عذراً، لقد انتهى تاريخ صلاحية الوصول إلى هذا الرابط.</p>
                  <a href="/" class="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-transparent rounded-lg font-medium text-sm transition shadow-sm">العودة للرئيسية</a>
                </div>
              </body>
            </html>
          `);
        }
      }

      // Check Click Limit
      if (link.clickLimit && link.clickCount >= link.clickLimit) {
        return res.status(403).send(`
          <html>
            <head>
              <title>تم الوصول للحد الأقصى للنقرات</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <script src="https://cdn.tailwindcss.com"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
            </head>
            <body class="bg-slate-50 text-slate-800 flex items-center justify-center min-h-screen" style="font-family: 'Inter', sans-serif;">
              <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 text-orange-500 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h1 class="text-xl font-semibold text-slate-900 mb-2">تم تجاوز حد الوصول!</h1>
                <p class="text-slate-500 mb-6 text-sm">لقد وصل هذا الرابط المصغر إلى الحد الأقصى المسموح به من النقرات (${link.clickLimit} نقرة).</p>
                <a href="/" class="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-transparent rounded-lg font-medium text-sm transition shadow-sm">العودة للرئيسية</a>
              </div>
            </body>
          </html>
        `);
      }

      // If password protection is enabled, handle authentication first
      const inputPassword = req.query.pwd;
      if (link.password && link.password !== inputPassword) {
        return res.send(`
          <html>
            <head>
              <title>رابط محمي بكلمة مرور</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <script src="https://cdn.tailwindcss.com"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
            </head>
            <body class="bg-slate-50 text-slate-800 flex items-center justify-center min-h-screen" style="font-family: 'Inter', sans-serif;">
              <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h1 class="text-xl font-semibold text-slate-900 mb-2">هذا الرابط محمي!</h1>
                <p class="text-slate-500 mb-6 text-sm">الرجاء إدخال كلمة المرور لتتم إعادة توجيهك إلى ملف Google Drive بشكل آمن.</p>
                
                ${inputPassword !== undefined ? '<p id="error" class="text-red-500 text-xs mb-4">كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.</p>' : ''}
                
                <form method="get" action="/r/${code}">
                  <input type="password" name="pwd" placeholder="أدخل كلمة المرور هنا" class="w-full px-4 py-3 border border-slate-200 rounded-xl mb-4 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" required>
                  <button type="submit" class="w-full px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition shadow-md duration-150">تأكيد ومتابعة التوجيه</button>
                </form>
              </div>
            </body>
          </html>
        `);
      }

      // Record Click event
      const userAgent = req.headers['user-agent'] || '';
      const referer = req.headers['referer'] || 'Direct / Bookmark';
      const { browser, os, device } = parseUserAgent(userAgent);

      // Estimate country from cloud headers if hosted on Cloud Run
      // "X-Appengine-Country" or "CloudFront-Viewer-Country" etc. are common
      const country = (req.headers['x-appengine-country'] as string) || undefined;

      const clickEvent: ClickEvent = {
        id: Math.random().toString(36).substring(2, 11),
        linkId: link.id,
        timestamp: Date.now(),
        userAgent,
        browser,
        os,
        device,
        referer,
        country
      };

      addClick(clickEvent);

      // Extract Drive elements and map destination URL
      const { id: driveId, type: driveType } = parseDriveUrl(link.originalUrl);
      const finalDestination = buildRedirectionUrl(link.originalUrl, driveId, driveType, link.exportType);

      // Standard instant redirect
      res.redirect(302, finalDestination);
    } catch (err: any) {
      res.status(500).send(`Error: ${err.message}`);
    }
  });

  // Vite development vs production asset handling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server fully started and running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server startup failed:', err);
});
