const request = require('request');
const cheerio = require('cheerio');
const isUrl = require('is-url');
const events = require('events');
const scraper = new events.EventEmitter();

const SITE = process.env.SITE;
const CONCURRENCY_LIMIT = process.env.CONCURRENCY_LIMIT || 5;
let concurrency = 0;
let links = [];
let scrapedLinks = [];

/**
 *  Extract links from HTML
 *  @param {string} html - HTML to parse
 *  @returns {Array} List of links
 */
function extractLinks(html) {
  const $ = cheerio.load(html);
  return $('a')
           .toArray()
           .map(tag => tag.attribs.href);
}

/**
 *  Sanitizes links - remove duplicates and invalid urls
 *  @param {Array} list - List of links
 *  @returns {Array} List of sanitized links
 */
function sanitizeLinks(list) {
  return list
           .filter((link, index) => (
             isUrl(link)                          // The link is avalid URL
             && links.indexOf(link) === -1        // The link is not already in queue
             && list.indexOf(link) === index      // The link isn't in the current batch
             && scrapedLinks.indexOf(link) === -1 // The link isn't already screaped
           ));
}

/**
 *  Scrape a website
 *  @param {string} url - URL to scrape
 */
function scrape(url) {
  scrapedLinks.push(url);
  request(url, (err, res, body) => {
    if (err) return;
    links = links.concat(sanitizeLinks(extractLinks(body)));
    scraper.emit('finished', url);
  });
}

function throttleScraping(url, limit) {
  console.log(`Started scraping ${url}`);
  scrape(url);
  concurrency++;
  scraper.on('finished', (link) => {
    console.log(`Concurrency: ${concurrency} | Finished: ${link}`);
    console.log(`Pending: ${links.length} | Done: ${scrapedLinks.length}`);
    concurrency--;
    if (!links.length) {
      console.log(scrapedLinks.join(','));
      return;
    }
    while(concurrency < limit && links.length) {
      scrape(links.shift());
      concurrency++;
    }
  });
}

throttleScraping(SITE, CONCURRENCY_LIMIT);
