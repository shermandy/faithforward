const markdownIt = require("markdown-it");
const iterator = require("markdown-it-for-inline");

// Initialize markdown-it with options and the external links iterator
const mdLib = markdownIt({
  html: true, // Allow HTML tags in markdown input
  breaks: true, // Convert single line breaks ('\n') into <br> tags
  linkify: true, // Autoconvert URL-like text to links
}).use(iterator, "url_new_win", "link_open", function (tokens, idx) {
  const aIndex = tokens[idx].attrIndex("href");

  if (aIndex >= 0) {
    const href = tokens[idx].attrs[aIndex][1];

    // Check if link is external (starts with http:// or https://)
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrPush(["target", "_blank"]);
      tokens[idx].attrPush(["rel", "noopener noreferrer"]);
    }
  }
});

module.exports = function (eleventyConfig) {
  // Set custom markdown-it instance as default Markdown parser for .md files
  eleventyConfig.setLibrary("md", mdLib);

  // Passthrough copies
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("assets");

  // Custom filter to sort nav items by 'navOrder' frontmatter
  eleventyConfig.addFilter("sortByOrder", function (collection) {
    if (!collection) return [];
    return [...collection].sort((a, b) => {
      return (a.data.navOrder || 0) - (b.data.navOrder || 0);
    });
  });

  // Add Markdown parsing filter for frontmatter/block content strings
  eleventyConfig.addFilter("markdown", function (content) {
    if (!content) return "";
    return mdLib.render(content);
  });

  // Collection for Upcoming Events (filters out past events & sorts chronologically)
  eleventyConfig.addCollection("events", function (collectionApi) {
    const now = new Date();

    return collectionApi
      .getFilteredByGlob("./content/events/*.md")
      .filter((item) => {
        if (!item.data.event_date) return false;

        // Convert spaces to ISO 'T' so Node parses 'YYYY-MM-DD HH:mm' reliably
        const dateStr = String(item.data.event_date).replace(" ", "T");
        const eventDate = new Date(dateStr);

        return !isNaN(eventDate) && eventDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(String(a.data.event_date).replace(" ", "T"));
        const dateB = new Date(String(b.data.event_date).replace(" ", "T"));
        return dateA - dateB;
      });
  });

  // Date formatting filter for Nunjucks templates
  eleventyConfig.addFilter("formatDate", function (dateObj) {
    if (!dateObj) return "";

    const dateStr = String(dateObj).replace(" ", "T");
    const d = new Date(dateStr);

    if (isNaN(d)) return dateObj;

    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  });

  // Time formatting filter
  eleventyConfig.addFilter("formatTime", function (dateObj) {
    if (!dateObj) return "";
    const dateStr = String(dateObj).replace(" ", "T");
    const d = new Date(dateStr);
    if (isNaN(d)) return "";

    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  });

  // Single / multi-day event date formatting filter
  eleventyConfig.addFilter(
    "formatEventDates",
    function (startDateObj, endDateObj) {
      if (!startDateObj) return "";

      const startStr = String(startDateObj).replace(" ", "T");
      const start = new Date(startStr);
      if (isNaN(start)) return startDateObj;

      const formatDate = (d) =>
        d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

      const formatTime = (d) =>
        d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

      if (!endDateObj) {
        return formatDate(start);
      }

      const endStr = String(endDateObj).replace(" ", "T");
      const end = new Date(endStr);
      if (isNaN(end)) return formatDate(start);

      // Check if start and end are on the exact same calendar day
      const isSameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();

      if (isSameDay) {
        return `${formatDate(start)} – ${formatTime(end)}`;
      } else {
        return `${formatDate(start)} – ${formatDate(end)}`;
      }
    },
  );

  // Google Calendar URL generator
  eleventyConfig.addFilter("gcalUrl", function (event) {
    if (!event || !event.event_date) return "#";

    const startStr = String(event.event_date).replace(" ", "T");
    const startDate = new Date(startStr);

    if (isNaN(startDate)) return "#";

    let endDate;
    if (event.event_end_date) {
      const endStr = String(event.event_end_date).replace(" ", "T");
      endDate = new Date(endStr);
    }

    // Fallback: 2 hours if end date is missing or invalid
    if (!endDate || isNaN(endDate)) {
      endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }

    const formatGCalDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;

    const baseUrl = "https://calendar.google.com/calendar/render";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title || "",
      dates: dates,
      details: event.summary || "",
      location: event.location || "",
    });

    return `${baseUrl}?${params.toString()}`;
  });

  // iCal (.ics) Data URI generator
  eleventyConfig.addFilter("icsUrl", function (event) {
    if (!event || !event.event_date) return "#";

    const startStr = String(event.event_date).replace(" ", "T");
    const startDate = new Date(startStr);
    if (isNaN(startDate)) return "#";

    let endDate;
    if (event.event_end_date) {
      const endStr = String(event.event_end_date).replace(" ", "T");
      endDate = new Date(endStr);
    }

    // Fallback to 2 hours if end date is missing or invalid
    if (!endDate || isNaN(endDate)) {
      endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }

    const formatICSDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const cleanText = (str) =>
      (str || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");

    const title = cleanText(event.title || "Event");
    const summary = cleanText(event.summary || "");
    const location = cleanText(event.location || "");
    const startICS = formatICSDate(startDate);
    const endICS = formatICSDate(endDate);
    const nowICS = formatICSDate(new Date());

    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Eleventy Event System//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${startICS}-${title.replace(/\s+/g, "_")}@site`,
      `DTSTAMP:${nowICS}`,
      `DTSTART:${startICS}`,
      `DTEND:${endICS}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${summary}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return `data:text/calendar;charset=utf8,${encodeURIComponent(icsData)}`;
  });

  return {
    dir: {
      input: ".",
      output: "_site",
    },
  };
};
