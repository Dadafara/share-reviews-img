const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

const pathToFonts = path.resolve(process.cwd(), "fonts");
process.env.FONTCONFIG_PATH = pathToFonts;
const helveticaBoldPath = path.resolve(pathToFonts, "Helvetica Bold.ttf");

const languageRatings = {
  en: {
    ratings: ["Bad", "Low", "Medium", "Great", "Excellent"],
    text_1: "Rated",
    text_2: "by",
    text_3: "reviews",
  },
  fr: {
    ratings: ["Mauvais", "Bas", "Moyen", "Bien", "Excellent"],
    text_1: "Noté",
    text_2: "par",
    text_3: "avis",
  },
  de: {
    ratings: ["Schlecht", "Niedrig", "Mittel", "Gut", "Ausgezeichnet"],
    text_1: "Bewertet",
    text_2: "von",
    text_3: "Bewertungen",
  },
  it: {
    ratings: ["Cattivo", "Basso", "Medio", "Buono", "Eccellente"],
    text_1: "Valutato",
    text_2: "da",
    text_3: "recensioni",
  },
  pt: {
    ratings: ["Mau", "Baixo", "Médio", "Bom", "Excelente"],
    text_1: "Avaliado",
    text_2: "por",
    text_3: "opiniões",
  },
  es: {
    ratings: ["Malo", "Bajo", "Medio", "Bueno", "Excelente"],
    text_1: "Calificado",
    text_2: "por",
    text_3: "opiniones",
  },
  nl: {
    ratings: ["Slecht", "Laag", "Gemiddeld", "Goed", "Uitstekend"],
    text_1: "Beoordeeld",
    text_2: "door",
    text_3: "beoordelingen",
  },
};

// Fonction pour arrondir
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
    return x;
  }
}

const CDN_BASE_URL = "https://www.starevaluator.com";

function getLanguageData(lang) {
  return languageRatings[lang];
}

function truncateText(text, maxLines, maxLineLength) {
  const words = text.split(" ");
  let truncatedText = "";
  let lineCount = 0;
  let line = "";

  for (const word of words) {
    if ((line + word).length > maxLineLength) {
      truncatedText += line.trim() + "\n";
      line = word + " ";
      lineCount++;
    } else {
      line += word + " ";
    }

    if (lineCount >= maxLines) {
      truncatedText += "...";
      return truncatedText;
    }
  }

  if (lineCount < maxLines) {
    truncatedText += line.trim();
  }

  return truncatedText;
}

async function fetchImageToBase64(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });
  const base64String = Buffer.from(response.data, "binary").toString("base64");
  return `data:image/png;base64,${base64String}`;
}

async function handler(req, res) {
  const { data, locale } = req.query;

  if (!data || !locale) {
    res
      .status(400)
      .json({ error: "Missing required query parameters 'data' or 'locale'." });
  }

  // Validation de locale
  function isValidLocale(locale) {
    const supportedLocales = ["fr", "de", "pt", "nl", "it", "es", "en"];
    return locale ? supportedLocales.includes(locale) : false;
  }

  if (!isValidLocale(locale)) {
    res.status(404).json({
      error: "Locale not supported",
    });
  }

  const { ratings, text_1, text_2, text_3 } = getLanguageData(locale);

  let review;
  try {
    const reviewResponse = await axios(
      `https://api-starevaluator.com/api/review/id/${data}`
    );
    review = reviewResponse.data;
  } catch (error) {
    return res.status(500).json({ error: "Error fetching review data." });
  }

  const ratingIndex = Math.min(Math.floor(review.note), 4);
  const ratingText = ratings[ratingIndex];
  const rating = roundToHalf(review.note);

  const imageURLLogo = `${CDN_BASE_URL}/star-evaluator-bleu.png`;
  const imageURLRating = `${CDN_BASE_URL}/ratings/${rating}.png`;
  let imageBase64Rating;
  let imageBase64Logo;

  try {
    [imageBase64Logo, imageBase64Rating] = await Promise.all([
      fetchImageToBase64(imageURLLogo),
      fetchImageToBase64(imageURLRating),
    ]);
  } catch (error) {
    console.error("Error converting images to Base64:", error);
    res.status(500).json({
      error: "Error converting images to Base64.",
    });
  }

  const svgWidth = 1200;
  const svgHeight = 600;
  const topMargin = 50;
  const lineHeight = 40;

  const truncatedText = truncateText(review.experience, 7, 60);

  const svgImage = `
  <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style type="text/css">
        @font-face {
          font-family: "Helvetica";
          src: url("${helveticaBoldPath}");
        }
        .title {
          font-size: 80px;
          font-family: "Helvetica";
          text-anchor: start;
          dominant-baseline: middle;
          letter-spacing: 1px;
          word-spacing: 5px;
        }
        .review-text {
          font-size: 40px;
          font-family: "Helvetica";
          text-anchor: start;
          margin-right: 100px;
          fill: #000;
        }
        .rating {
          font-size: 34px;
          font-family: "Helvetica";
          text-anchor: start;
          fill: #000;
        }
        .line {
          stroke: black;
          stroke-width: 0.5;
        }
        .logo {
          font-size: 30px;
        }
      </style>
    </defs>
    <rect width="100%" height="100%" fill="white"/>
  
    <!-- Review text -->
    <g transform="translate(50, ${svgWidth - 300})">
      <text class="review-text" x2="${svgWidth - 50}">
        ${truncatedText
          .split("\n")
          .map(
            (line, index) =>
              `<tspan x1="50" dy="${lineHeight}" x2="${
                svgWidth - 50
              }">${line}</tspan>`
          )
          .join("")}
      </text>
    </g>

    <!-- Rating stars -->
    <g transform="translate(50, 400)">
      <image href="${imageBase64Rating}" height="50" width="250" />
      <text class="rating" transform="translate(270, 35)">
        ${text_2} ${review.username}
      </text>
    </g>
  
    <line class="line" x1="50" y1="490" x2="${svgWidth - 50}" y2="490"/>
  
    <!-- Number of reviews and Company logo -->
    <g transform="translate(50, 500)">
      <text class="rating" transform="translate(0, 35)">
        ${text_1} ${rating} / 5 | ${review.total_reviews} ${text_3}
      </text>
      <g transform="translate(${svgWidth - 300}, 0)">
        <image class="logo" href="${imageBase64Logo}" height="50" width="200" />
      </g>
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
    "public, immutable, no-transform, s-maxage=31536000, max-age=31536000"
  );
  res.send(imageBuffer);
}

module.exports = handler;
