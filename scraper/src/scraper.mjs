import { chromium } from "playwright";

const POST_SELECTOR = 'article[data-testid="tweet"]';
const LOGIN_PATTERNS = /inicia sesi[oó]n|log in|sign in|crear una cuenta|create account/i;
const ERROR_PATTERNS = /esta cuenta no existe|this account doesn.t exist|cuenta suspendida|account suspended/i;

async function dismissObstructions(page) {
  const closeButtons = page.getByRole("button", { name: /cerrar|close/i });
  const count = await closeButtons.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 2); index += 1) {
    const button = closeButtons.nth(index);
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 1500 }).catch(() => {});
    }
  }
}

async function readVisiblePosts(page, targetHandle) {
  return page.locator(POST_SELECTOR).evaluateAll((articles, expectedHandle) => {
    const normalizedExpected = String(expectedHandle).toLowerCase();
    return articles.map((article) => {
      const time = article.querySelector("time[datetime]");
      const statusAnchor = time?.closest('a[href*="/status/"]');
      const href = statusAnchor?.getAttribute("href") || "";
      const match = href.match(/^\/([^/]+)\/status\/(\d+)/i);
      if (!time || !match) return null;

      const author = match[1];
      const id = match[2];
      const articleText = article.innerText || "";
      const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
      const isReply = /replying to|en respuesta a/i.test(articleText);
      const isPinned = /pinned|fijado|fijada/i.test(socialContext);
      const isRepost = /reposted|reposte[oó]|retwitte[oó]/i.test(socialContext);
      const tweetText = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || "";
      const mediaUrls = Array.from(article.querySelectorAll('[data-testid="tweetPhoto"] img[src]'))
        .map((image) => image.getAttribute("src"))
        .filter(Boolean);

      return {
        id,
        author,
        publishedAt: time.getAttribute("datetime"),
        text: tweetText,
        url: `https://x.com/${author}/status/${id}`,
        hasVideo: Boolean(article.querySelector('[data-testid="videoPlayer"], video')),
        hasPhoto: mediaUrls.length > 0,
        mediaUrls: [...new Set(mediaUrls)],
        isReply,
        isPinned,
        isRepost,
        isOwn: author.toLowerCase() === normalizedExpected,
      };
    }).filter(Boolean);
  }, targetHandle);
}

function oldestUnpinned(posts) {
  const dates = posts
    .filter((post) => !post.isPinned)
    .map((post) => new Date(post.publishedAt).getTime())
    .filter(Number.isFinite);
  return dates.length ? Math.min(...dates) : Number.POSITIVE_INFINITY;
}

export async function scrapeXProfile({ handle, start, end, maxPosts = 1000, timeZone = "America/Mexico_City" }) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const context = await browser.newContext({
    locale: "es-MX",
    timezoneId: timeZone,
    viewport: { width: 1440, height: 1100 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const collected = new Map();
  let roundsWithoutNewPosts = 0;
  let iterations = 0;

  try {
    const response = await page.goto(`https://x.com/${handle}`, {
      waitUntil: "domcontentloaded",
      timeout: 75_000,
    });
    if (response && response.status() >= 400) {
      throw new Error(`X respondió con el código ${response.status()} al abrir el perfil.`);
    }

    await dismissObstructions(page);
    await page.waitForSelector(POST_SELECTOR, { timeout: 35_000 }).catch(async () => {
      const body = await page.locator("body").innerText().catch(() => "");
      if (ERROR_PATTERNS.test(body)) throw new Error("El perfil no existe, está suspendido o no es público.");
      if (LOGIN_PATTERNS.test(body)) {
        throw new Error("X solicitó iniciar sesión y no permitió consultar públicamente este perfil.");
      }
      throw new Error("No se encontraron publicaciones visibles en el perfil.");
    });

    while (iterations < 420 && collected.size < maxPosts) {
      iterations += 1;
      const visible = await readVisiblePosts(page, handle);
      let added = 0;

      for (const post of visible) {
        if (!post.isOwn || post.isReply || post.isRepost) continue;
        if (!collected.has(post.id)) {
          collected.set(post.id, post);
          added += 1;
        }
      }

      roundsWithoutNewPosts = added === 0 ? roundsWithoutNewPosts + 1 : 0;
      const oldest = oldestUnpinned([...collected.values()]);
      if (oldest <= start.getTime() && collected.size > 0) break;
      if (roundsWithoutNewPosts >= 14) break;

      await page.evaluate(() => {
        const amount = Math.max(760, Math.floor(window.innerHeight * 0.86));
        window.scrollBy(0, amount);
      });
      await page.waitForTimeout(1350);
      if (iterations % 12 === 0) await dismissObstructions(page);
    }

    const posts = [...collected.values()]
      .filter((post) => {
        const timestamp = new Date(post.publishedAt).getTime();
        return timestamp >= start.getTime() && timestamp <= end.getTime();
      })
      .sort((left, right) => new Date(left.publishedAt) - new Date(right.publishedAt))
      .slice(0, maxPosts);

    if (!posts.length) {
      const oldest = oldestUnpinned([...collected.values()]);
      const diagnostic = Number.isFinite(oldest)
        ? ` La publicación más antigua cargada fue ${new Date(oldest).toISOString().slice(0, 10)}.`
        : "";
      throw new Error(`No se encontraron publicaciones propias en el intervalo solicitado.${diagnostic}`);
    }

    return {
      posts,
      diagnostics: {
        iterations,
        uniqueOwnPostsSeen: collected.size,
        stoppedAfterNoNewPosts: roundsWithoutNewPosts >= 14,
      },
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
