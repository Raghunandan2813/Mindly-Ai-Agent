// lib/dateDetect.ts
// Parse semantic relative dates like "last month", "yesterday", etc.

interface DateRange {
    from: Date;
    to: Date;
}

const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

export function detectDateRange(query: string): DateRange | null {
    const q = query.toLowerCase();
    const now = new Date();

    const start = (d: Date): Date => new Date(d.setHours(0, 0, 0, 0));
    const end = (d: Date): Date => new Date(d.setHours(23, 59, 59, 999));

    if (q.includes('today'))
        return { from: start(new Date()), to: new Date() };

    if (q.includes('yesterday')) {
        const d = new Date(); d.setDate(d.getDate() - 1);
        return { from: start(d), to: end(new Date(d)) };
    }
    if (q.includes('last week')) {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return { from: d, to: now };
    }
    if (q.includes('last month')) {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return { from: d, to: now };
    }
    if (q.includes('last year')) {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1);
        return { from: d, to: now };
    }

    // detect "on 3 may" or "may 3" patterns
    const dateMatch = q.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    if (dateMatch) {
        const d = new Date(now.getFullYear(), MONTHS[dateMatch[2]], parseInt(dateMatch[1]));
        return { from: start(d), to: end(new Date(d)) };
    }

    return null;
}