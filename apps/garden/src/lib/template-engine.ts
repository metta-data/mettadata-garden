/**
 * Template variable processor inspired by Obsidian's Templater.
 *
 * Supported variables:
 *   {{title}}         — note title
 *   {{date}}          — today's date (YYYY-MM-DD)
 *   {{date:FORMAT}}   — today's date in custom format
 *   {{time}}          — current time (HH:mm)
 *   {{time:FORMAT}}   — current time in custom format
 *   {{garden}}        — garden name
 *   {{folder}}        — folder name (empty if root)
 *   {{now}}           — full ISO timestamp
 *   {{yesterday}}     — yesterday's date (YYYY-MM-DD)
 *   {{tomorrow}}      — tomorrow's date (YYYY-MM-DD)
 *
 * Date format tokens: YYYY, YY, MM, DD, ddd, dddd, HH, mm, ss
 */

interface TemplateContext {
  title?: string;
  garden?: string;
  folder?: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(date: Date, format: string): string {
  return format
    .replace("YYYY", String(date.getFullYear()))
    .replace("YY", String(date.getFullYear()).slice(-2))
    .replace("MMMM", MONTH_NAMES[date.getMonth()])
    .replace("MMM", MONTH_SHORT[date.getMonth()])
    .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
    .replace("DD", String(date.getDate()).padStart(2, "0"))
    .replace("dddd", DAY_NAMES[date.getDay()])
    .replace("ddd", DAY_SHORT[date.getDay()])
    .replace("HH", String(date.getHours()).padStart(2, "0"))
    .replace("mm", String(date.getMinutes()).padStart(2, "0"))
    .replace("ss", String(date.getSeconds()).padStart(2, "0"));
}

function shiftDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const VARIABLE_REGEX = /\{\{(\w+)(?::([^}]+))?\}\}/g;

export function processTemplate(template: string, ctx: TemplateContext = {}): string {
  const now = new Date();
  const dateStr = formatDate(now, "YYYY-MM-DD");
  const timeStr = formatDate(now, "HH:mm");

  return template.replace(VARIABLE_REGEX, (match, variable: string, format?: string) => {
    switch (variable) {
      case "title":
        return ctx.title || "";
      case "date":
        return format ? formatDate(now, format) : dateStr;
      case "time":
        return format ? formatDate(now, format) : timeStr;
      case "now":
        return now.toISOString();
      case "yesterday":
        return format ? formatDate(shiftDate(now, -1), format) : formatDate(shiftDate(now, -1), "YYYY-MM-DD");
      case "tomorrow":
        return format ? formatDate(shiftDate(now, 1), format) : formatDate(shiftDate(now, 1), "YYYY-MM-DD");
      case "garden":
        return ctx.garden || "";
      case "folder":
        return ctx.folder || "";
      default:
        return match; // Leave unknown variables as-is
    }
  });
}

/**
 * Process template variables in both frontmatter fields and body content.
 */
export function processTemplateFull(
  templateBody: string,
  ctx: TemplateContext = {}
): string {
  return processTemplate(templateBody, ctx);
}
