import fs from 'fs';
import path from 'path';
import { ShortLink, ClickEvent } from '../src/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface Schema {
  links: ShortLink[];
  clicks: ClickEvent[];
}

let dbCache: Schema = {
  links: [],
  clicks: []
};

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } else {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(data);
      // Ensure arrays exist
      if (!dbCache.links) dbCache.links = [];
      if (!dbCache.clicks) dbCache.clicks = [];
    } catch (err) {
      console.error('Error reading DB, reinitializing:', err);
      dbCache = { links: [], clicks: [] };
    }
  }
}

// Lazy init
ensureDbExists();

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

export function getLinks(): ShortLink[] {
  ensureDbExists();
  return dbCache.links;
}

export function getLinkByShortId(shortId: string): ShortLink | null {
  ensureDbExists();
  return dbCache.links.find(l => l.shortId === shortId) || null;
}

export function addLink(link: ShortLink): void {
  ensureDbExists();
  dbCache.links.unshift(link); // Newest first
  saveDb();
}

export function deleteLink(id: string): boolean {
  ensureDbExists();
  const initialLength = dbCache.links.length;
  dbCache.links = dbCache.links.filter(l => l.id !== id);
  dbCache.clicks = dbCache.clicks.filter(c => c.linkId !== id);
  const deleted = dbCache.links.length < initialLength;
  if (deleted) {
    saveDb();
  }
  return deleted;
}

export function addClick(click: ClickEvent): void {
  ensureDbExists();
  dbCache.clicks.push(click);
  
  // Increment link click count
  const link = dbCache.links.find(l => l.id === click.linkId);
  if (link) {
    link.clickCount = (link.clickCount || 0) + 1;
  }
  
  saveDb();
}

export function getClicksForLink(linkId: string): ClickEvent[] {
  ensureDbExists();
  return dbCache.clicks.filter(c => c.linkId === linkId);
}

export function getAllClicks(): ClickEvent[] {
  ensureDbExists();
  return dbCache.clicks;
}
