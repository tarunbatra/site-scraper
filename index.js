const request = require('request');
const cheerio = require('cheerio');
const isUrl = require('is-url');
const events = require('events');
const scraper = new events.EventEmitter();

const SITE = removeTrailingSlash(process.env.SITE);
const CONCURRENCY_LIMIT = process.env.CONCURRENCY_LIMIT || 5;
let concurrency = 0;
let links = [];
let scrapedLinks = [];

/**
 *  Remove trailing slashes in a string
 *  @param {string} str - Input string
 *  @returns {string} String with trailing slash trimmed
 */
function removeTrailingSlash(str = '') {
  return str.replace(/\/$/, '');
}

/**
 *  Checks if the link is in provided domain
 *  @param {string} link - Link to check
 *  @param {string} link - Link to check
 *  @returns {boolean} True if link belongs to the domain
 */
function isInDoman(link = '', domain = '') {
  return link.startsWith(domain);
}

/**
 *  Extract links from HTML
 *  @param {string} html - HTML to parse
 *  @returns {Array} List of links
 */
function extractLinks(html) {
  const $ = cheerio.load(html);
  return $('a')
          .toArray()
          .map(tag => {
            const href = removeTrailingSlash(tag.attribs.href);
            return isUrl(href)
              ? href
              : `${SITE}${href.startsWith('/') ? '' : '/'}${href}`
           });
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
             && isInDoman(link, SITE)             // The link is in same domain as the SITE
           ));
}

/**
 *  Scrape a website
 *  @param {string} url - URL to scrape
 */
function scrape(url) {
  return new Promise((resolve, reject) => {
    scrapedLinks.push(url);
    request(url, (err, res, body) => {
      if (err) return reject(err);
      links = links.concat(sanitizeLinks(extractLinks(body)));
      scraper.emit('finished', url);
      resolve(url);
    });
  });
}

function throttleScraping(url, limit) {
  console.log(`Started scraping ${url}`);
  scrape(url)
    .catch(console.error);
  concurrency++;
  scraper.on('finished', (link) => {
    console.log(`Concurrency: ${concurrency} | Finished: ${link}`);
    console.log(`Pending: ${links.length} | Done: ${scrapedLinks.length}`);
    concurrency--;
    if (!links.length) {
      console.log(scrapedLinks.join(','));
    }
    while(concurrency < limit && links.length) {
      scrape(links.shift())
        .catch(console.error);
      concurrency++;
    }
  });
}

throttleScraping(SITE, CONCURRENCY_LIMIT);
