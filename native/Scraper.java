package by.barsu.student;

import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.select.Elements;

/** Загрузка и разбор расписания с rasp.barsu.by (повторяет логику страницы). */
final class Scraper {
    static final String BASE = "https://rasp.barsu.by/";

    static final class Les {
        String timeKey;
        int s, e;
        String t, a;
        List<String[]> parts = new ArrayList<>();
    }

    private static final Map<String, Integer> WD = new HashMap<>();

    static {
        WD.put("по", 0); WD.put("пн", 0); WD.put("вт", 1); WD.put("ср", 2);
        WD.put("че", 3); WD.put("чт", 3); WD.put("пя", 4); WD.put("пт", 4);
        WD.put("су", 5); WD.put("сб", 5); WD.put("во", 6); WD.put("вс", 6);
    }

    static List<String> weekStarts() throws Exception {
        Net.Res r = Net.get(BASE + "stud.php");
        List<String> out = new ArrayList<>();
        Document d = Jsoup.parse(r.text);
        for (Element o : d.select("select[name=weekbegindate] option")) {
            String v = (o.hasAttr("value") ? o.attr("value") : o.text()).trim();
            if (v.matches("\\d{4}-\\d{2}-\\d{2}")) out.add(v);
        }
        return out;
    }

    /** date -> пары за неделю (семь дат, у пустых дней пустой список); null, если расписание не получено. */
    static Map<String, List<Les>> week(JSONObject f, String wk) throws Exception {
        boolean st = !"teach".equals(f.optString("kind"));
        String target = BASE + (st ? "stud.php" : "teach.php");
        Net.Res g = Net.get(target);
        LinkedHashMap<String, String> p = new LinkedHashMap<>();
        if (st) {
            p.put("faculty", f.optString("faculty"));
            p.put("speciality", f.optString("speciality"));
            p.put("groups", f.optString("groups"));
            p.put("weekbegindate", wk);
            p.put("date", "");
        } else {
            p.put("kafedra", f.optString("kafedra"));
            p.put("teacher", f.optString("teacher"));
            p.put("weekbegindate", wk);
        }
        p.put("go", "Показать");
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> en : p.entrySet()) {
            if (sb.length() > 0) sb.append('&');
            sb.append(URLEncoder.encode(en.getKey(), g.cs)).append('=').append(URLEncoder.encode(en.getValue(), g.cs));
        }
        Net.Res r = Net.post(target, sb.toString(), target);
        String h = r.text;

        int i = -1;
        Matcher m = Pattern.compile("Расписание\\s+на\\s+неделю", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(h);
        if (m.find()) i = m.start();
        if (i < 0) {
            Matcher t = Pattern.compile("<table[\\s\\S]*?</table>", Pattern.CASE_INSENSITIVE).matcher(h);
            int best = -1, bl = 0;
            while (t.find()) {
                int len = t.end() - t.start();
                if (len > bl) {
                    bl = len;
                    best = t.start();
                }
            }
            if (bl > 1500) i = best;
        }
        if (i < 0) return null;
        int e = h.indexOf("</table>", i);
        String html = e < 0 ? h.substring(i) : h.substring(i, e + 8);
        Document doc = Jsoup.parse("<body>" + html);
        Element tb = doc.selectFirst("table");
        if (tb == null) return null;
        return parse(tb, st, wk);
    }

    static Map<String, List<Les>> parse(Element tb, boolean st, String wk) {
        LinkedHashMap<String, List<Les>> out = new LinkedHashMap<>();
        for (int k = 0; k < 7; k++) out.put(addDays(wk, k), new ArrayList<Les>());
        List<List<Element>> g = grid(tb);
        Element curDay = null;
        String curDate = null;
        int dayIdx = -1;
        for (int r = 1; r < g.size(); r++) {
            List<Element> row = g.get(r);
            if (row.size() < 4) continue;
            Element d0 = row.get(0), t2 = row.get(2);
            if (d0 == null || t2 == null) continue;
            if (curDay != d0) {
                curDay = d0;
                dayIdx++;
                String dt = clean(d0.text());
                String k2 = dt.length() >= 2 ? dt.substring(0, 2).toLowerCase(Locale.ROOT) : "";
                Integer k = WD.get(k2);
                curDate = addDays(wk, k != null ? k : dayIdx);
            }
            String time = clean(t2.text());
            List<Element> cells = new ArrayList<>();
            for (int c = 3; c < row.size(); c++) {
                Element x = row.get(c);
                if (x != null && !cells.contains(x)) cells.add(x);
            }
            List<Les> day = out.get(curDate);
            if (day == null) {
                day = new ArrayList<>();
                out.put(curDate, day);
            }
            if (st) {
                int nc = row.size() - 3;
                for (int c = 3; c < row.size(); c++) {
                    Element cell = row.get(c);
                    if (cell == null) continue;
                    boolean dup = false;
                    for (int k = 3; k < c; k++) if (row.get(k) == cell) dup = true;
                    if (dup) continue;
                    int span = 0;
                    for (int k = 3; k < row.size(); k++) if (row.get(k) == cell) span++;
                    String sg = (nc > 1 && span < nc) ? sgLabel(g, c) : "";
                    List<String> ls = lines(cell);
                    if (ls.isEmpty()) continue;
                    for (List<String> b : blocks(ls)) add(day, time, b.get(0), audOf(b), sg);
                }
            } else if (!cells.isEmpty()) {
                String t0 = clean(cells.get(0).text());
                if (t0.isEmpty()) continue;
                String aud = cells.size() > 2 ? clean(cells.get(2).text()) : "";
                add(day, time, t0, aud.isEmpty() ? "" : "ауд. " + aud, "");
            }
        }
        return out;
    }

    private static void add(List<Les> day, String time, String title, String aud, String sg) {
        int[] t = parseT(time);
        if (t == null) return;
        for (Les l : day) {
            if (l.timeKey.equals(time)) {
                l.t = l.t + " / " + title;
                if (l.a.isEmpty()) l.a = aud;
                l.parts.add(new String[] {sg, title, aud});
                return;
            }
        }
        Les l = new Les();
        l.timeKey = time;
        l.s = t[0];
        l.e = t[1];
        l.t = title;
        l.a = aud;
        l.parts.add(new String[] {sg, title, aud});
        day.add(l);
    }

    /** Метка подгруппы по заголовку столбца; если в заголовке номера нет, берём порядковый номер столбца. */
    private static String sgLabel(List<List<Element>> g, int c) {
        Element h = cell(g, 0, c);
        String t = h == null ? "" : clean(h.text());
        Matcher m = Pattern.compile("(\\d)\\s*[-–]?\\s*(?:я\\s*|ая\\s*)?(?:подгр|п/г)|(?:подгр|п/г)\\D{0,12}?(\\d)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(t);
        if (m.find()) return (m.group(1) != null ? m.group(1) : m.group(2)) + " п/г";
        return (c - 2) + " п/г";
    }

    static int[] parseT(String t) {
        Matcher m = Pattern.compile("(\\d{1,2})\\D(\\d{2})\\s*\\D{1,3}\\s*(\\d{1,2})\\D(\\d{2})").matcher(t == null ? "" : t);
        if (!m.find()) return null;
        int h = Integer.parseInt(m.group(1));
        int s = h * 60 + Integer.parseInt(m.group(2));
        int e = Integer.parseInt(m.group(3)) * 60 + Integer.parseInt(m.group(4));
        if (e <= s && h >= 10) {
            h = h % 10;
            s = h * 60 + Integer.parseInt(m.group(2));
        }
        return (e > s && e <= 24 * 60) ? new int[] {s, e} : null;
    }

    private static String audOf(List<String> b) {
        Pattern p = Pattern.compile("ауд", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        for (String x : b) if (p.matcher(x).find()) return x;
        return "";
    }

    private static List<List<String>> blocks(List<String> ls) {
        List<List<String>> o = new ArrayList<>();
        Pattern head = Pattern.compile("\\s-\\s\\S+$");
        Pattern frac = Pattern.compile("\\d/\\d");
        for (String l : ls) {
            if (o.isEmpty() || (head.matcher(l).find() && !frac.matcher(l).find())) {
                List<String> n = new ArrayList<>();
                n.add(l);
                o.add(n);
            } else {
                o.get(o.size() - 1).add(l);
            }
        }
        return o;
    }

    private static List<String> lines(Element td) {
        Element c = td.clone();
        Elements brs = c.select("br");
        for (Element br : brs) br.replaceWith((Node) new TextNode("\n"));
        List<String> o = new ArrayList<>();
        for (String s : c.wholeText().split("\n")) {
            s = clean(s);
            if (!s.isEmpty()) o.add(s);
        }
        return o;
    }

    private static String clean(String s) {
        return s.replaceAll("[\\s\\u00A0]+", " ").trim();
    }

    private static String addDays(String wk, int k) {
        String[] a = wk.split("-");
        Calendar cal = Calendar.getInstance();
        cal.clear();
        cal.set(Integer.parseInt(a[0]), Integer.parseInt(a[1]) - 1, Integer.parseInt(a[2]) + k);
        return Store.ymd(cal);
    }

    // ---------- сетка ячеек с учётом rowspan / colspan ----------
    private static List<List<Element>> grid(Element tb) {
        List<List<Element>> g = new ArrayList<>();
        Elements trs = tb.select("tr");
        for (int r = 0; r < trs.size(); r++) {
            while (g.size() <= r) g.add(new ArrayList<Element>());
            int c = 0;
            for (Element td : trs.get(r).children()) {
                String tn = td.tagName();
                if (!tn.equals("td") && !tn.equals("th")) continue;
                while (cell(g, r, c) != null) c++;
                int rs = span(td, "rowspan"), cs = span(td, "colspan");
                for (int i = 0; i < rs; i++) for (int j = 0; j < cs; j++) put(g, r + i, c + j, td);
                c += cs;
            }
        }
        return g;
    }

    private static int span(Element td, String a) {
        try {
            int v = Integer.parseInt(td.attr(a).trim());
            return v < 1 ? 1 : Math.min(v, 100);
        } catch (Exception e) {
            return 1;
        }
    }

    private static Element cell(List<List<Element>> g, int r, int c) {
        if (r >= g.size()) return null;
        List<Element> row = g.get(r);
        return c < row.size() ? row.get(c) : null;
    }

    private static void put(List<List<Element>> g, int r, int c, Element e) {
        while (g.size() <= r) g.add(new ArrayList<Element>());
        List<Element> row = g.get(r);
        while (row.size() <= c) row.add(null);
        row.set(c, e);
    }
}
