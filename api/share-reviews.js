const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

path.resolve(process.cwd(), "font", "font.conf");
path.resolve(process.cwd(), "fonts", "Helvetica Bold.ttf");

const languageRatings = {
  en: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
  fr: {
    text_1: "Noté",
    text_2: "par",
    text_3: "avis",
  },
  de: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
  it: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
  pt: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
  es: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
  nl: {
    text_1: "",
    text_2: "",
    text_3: "",
  },
};

function roundToHalf(x) {
  if (x === 0) {
    return 0;
  } else if (x > 0 && x <= 1) {
    return 1;
  } else if (x > 1 && x <= 1.7) {
    return 1.5;
  } else if (x > 1.7 && x <= 2) {
    return 2;
  } else if (x > 2 && x <= 2.7) {
    return 2.5;
  } else if (x > 2.7 && x <= 3) {
    return 3;
  } else if (x > 3 && x <= 3.7) {
    return 3.5;
  } else if (x > 3.7 && x <= 4) {
    return 4;
  } else if (x > 4 && x <= 4.7) {
    return 4.5;
  } else if (x > 4.7 && x <= 5) {
    return 5;
  } else {
    return x; // handle cases where x > 5 or x < 0, if needed
  }
}

const BASE_URL = "https://www.starevaluator.com";

function getLanguageData(lang) {
  return languageRatings[lang];
}

async function fetchImage(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });
  const base64String = Buffer.from(response.data, "binary").toString("base64");
  return `data:image/png;base64,${base64String}`;
}

async function handler(req, res) {
  const query = req.query || {};
  const { data, locale } = query;

  if (!data || !locale) {
    // Utilisation de writeHead pour définir le statut 400 (Bad Request)
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        error: "Missing required query parameters 'data' or 'locale'.",
      })
    );
  }

  function isValidLocale(locale) {
    const supportedLocales = ["fr", "de", "pt", "nl", "it", "es", "en"];
    return locale ? supportedLocales.includes(locale) : false;
  }

  if (!isValidLocale(locale)) {
    // Utilisation de writeHead pour définir le statut 404 (Not Found)
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Locale not supported" }));
  }

  const { ratings, text_1, text_2, text_3 } = getLanguageData(locale);

  let review;
  try {
    const response = await axios(
      `https://api-starevaluator.com/api/review/id/${data}`
    );
    review = response.data;
  } catch (error) {
    res.status(500).json({
      error: "Error fetching company data.",
    });
  }

  const ratingIndex = Math.min(Math.floor(company.note), 4);
  const ratingText = ratings[ratingIndex];
  const rating = roundToHalf(company.note);

  const imgLogo = `${BASE_URL}/star-evaluator-bleu.png`;
  const imgRating = `${BASE_URL}/rating/${rating}.png`;

  let imgBaseRating;
  let imgBaseLogo;

  try {
    [imgBaseRating, imgBaseLogo] = await Promise.all([
      fetchImage(imgRating),
      fetchImage(imgLogo),
    ]);
  } catch (error) {
    res.status(500).json({
      error: "Error converting images",
    });
  }
  const text =
    locale === "de"
      ? `${text_1} ${review.experience}: ${ratingText}`
      : ` ${review.username} ${text_1} ${ratingText}`;

  const svgWidth = 1200;
  const svgHeight = 630;
  const leftMargin = 150;
  const leftMarginText = 155;
  const leftMarginRatting = 143;
  const titleY = 150;

  const wrappedText = wrapText(text, 27);

  const svgImage = `
  <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style type="text/css">
        @font-face {
          font-family: "Helvetica";
          src: "./fonts/Helvetica Bold.ttf";
        }
        .title {
          font-size: 72px;
          font-family: "Helvetica";
          text-anchor: start;
        }
        .title_2 {
          font-size: 72px;
          font-family: "Helvetica";
          text-anchor: start;
          font-weight: bold;
        }
        .rating {
          font-size: 30px;
          font-family: "Helvetica";
          text-anchor: start;
        }
      </style>
    </defs>
    <rect width="100%" height="100%" fill="white"/>
  
    <!-- Title Rows -->
    ${wrappedText
      .map(
        (line, index) => `
      <g transform="translate(${leftMargin}, ${titleY + index * 80})">
        <text class="title">${line.replace(
          ratingText,
          `<tspan class="title_2">${review.experience}</tspan>`
        )}</text>
      </g>
    `
      )
      .join("")}
  
    <g transform="translate(${leftMarginText}, ${
    titleY + wrappedText.length * 80 + 50
  })">
      <text class="rating">
  
   ${company.reviews.length} ${text_3}</text>
    </g>
  
    <!-- Rating Image Row -->
    <g transform="translate(${leftMarginRatting}, ${
    titleY + wrappedText.length * 80 + 20 + 10
  })">
      <image
        class="img-rating"
        href="${imgBaseRating}"
        height="150"
        width="350"
      />
    </g>
  
    <!-- Logo Row -->
    <g transform="translate(${leftMargin}, ${
    titleY + wrappedText.length * 80 + 80 + 60
  })">
      <image
        class="img-logo"
        href="${imgBaseLogo}"
        height="80"
        width="250"
      />
      <text class="rating">
  
       ${text_2} ${review.username}</text>
    </g>
  </svg>
  `;

  const imageBuffer = await sharp(Buffer.from(svgImage))
    .resize(1200, 630)
    .png({ quality: 100 })
    .withMetadata({ density: 300 })
    .toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Cache-Control",
    `public, immutable, no-transform, s-maxage=31536000, max-age=31536000`
  );
  res.writeHead(200, { "Content-Type": "image/png" });
  res.end(imageBuffer);
}

module.exports = handler;
