const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

const pathToFonts = path.resolve(process.cwd(), "fonts");

process.env.FONTCONFIG_PATH = pathToFonts;

const helveticaBoldPath = path.resolve(pathToFonts, "Helvetica Bold.ttf");
// path.resolve(process.cwd(), "fonts", "Helvetica.ttf");

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

const CDN_BASE_URL = "https://www.starevaluator.com";

function getLanguageData(lang) {
  return languageRatings[lang];
}

function wrapText(text, maxLength) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words.shift() || "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;

    if (testLine.length <= maxLength) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
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

  let company, review;
  try {
    const [companyResponse, reviewResponse] = await Promise.all([
      axios(`https://api-starevaluator.com/api/company/id/${data}`),
      axios(`https://api-starevaluator.com/api/review/id/${id}`),
    ]);
    company = companyResponse.data;
    review = reviewResponse.id;
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error fetching company or review data." });
  }

  const ratingIndex = Math.min(Math.floor(review.note), 4);
  const ratingText = ratings[ratingIndex];
  const rating = roundToHalf(review.note);

  const imageURLLogo = `${CDN_BASE_URL}/star-evaluator-bleu.png`;
  const imageURLRating = `${CDN_BASE_URL}/ratings/${rating}.png`;

  let imageBase64Logo;
  let imageBase64Rating;

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
  const text =
    locale === "de"
      ? `${text_1} ${review.company_name}: ${ratingText}`
      : ` ${review.company_name} ${text_1} ${ratingText}`;

  const svgWidth = 1200;
  const svgHeight = 630;
  const leftMargin = 150;
  const leftMarginText = 150;
  const leftMarginRatting = 150;
  const leftMarginLogo = 135;
  const titleY = 150;

  const wrappedText = wrapText(text, 27);

  const svgImage = `
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: "Helvetica";
        src: url("${helveticaBoldPath}");
      }
      .title {
        font-size: 10px;
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
      <text class="title">${review.experience}
      </text>
    </g>
  `
    )
    .join("")}

  <g transform="translate(${leftMarginText}, ${
    titleY + wrappedText.length * 80 + 50
  })">
    <text class="rating">${text_2}

 ${review.username}</text>
  </g>

  <!-- Rating Image Row -->
  <g transform="translate(${leftMarginRatting}, ${
    titleY + wrappedText.length * 80 + 20 + 10
  })">
    <image
      class="img-rating"
      href="${imageBase64Rating}"
      height="100"
      width="300"
    />
    <text class="rating" transform="translate(${leftMarginText}, ${
    titleY + wrappedText.length * 80 + 50
  })">${text_2} ${review.username}</text>
  </g>
<g transform="translate(${leftMarginText}, ${
    titleY + wrappedText.length * 80 + 50
  })">
  <text class="rating">
 ${company.total_reviews} ${text_2}</text>
  </g>

  <!-- Logo Row -->
  <g transform="translate(${leftMarginLogo}, ${
    titleY + wrappedText.length * 80 + 80 + 60
  })">
    <image
      class="img-logo"
      href="${imageBase64Logo}"
      height="100"
      width="350"
    />
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
  res.send(imageBuffer);
}
module.exports = handler;
