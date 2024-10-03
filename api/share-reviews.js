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
  // Add other language data here as needed
};

function roundToHalf(x) {
  return Math.round(x * 2) / 2;
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
    const testLine = currentLine + " " + word;

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
    return;
  }

  function isValidLocale(locale) {
    const supportedLocales = ["fr", "de", "pt", "nl", "it", "es", "en"];
    return supportedLocales.includes(locale);
  }

  if (!isValidLocale(locale)) {
    res.status(404).json({
      error: "Locale not supported",
    });
    return;
  }

  const { ratings, text_1, text_2, text_3 } = getLanguageData(locale);

  let company, review;
  try {
    const [companyResponse, reviewResponse] = await Promise.all([
      axios(`https://api-starevaluator.com/api/company/id/${data}`),
      axios(`https://api-starevaluator.com/api/review/id/${data}`),
    ]);
    company = companyResponse.data;
    review = reviewResponse.data;
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
    return;
  }

  const wrappedText = wrapText(review.experience, 60);

  const svgWidth = 1200;
  const svgHeight = 630;

  const svgImage = `
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: "Helvetica";
        src: url("${helveticaBoldPath}");
      }
      .title {
        font-size: 48px;
        font-family: "Helvetica";
        font-weight: bold;
        text-anchor: start;
        fill: #000;
      }
      .review-text {
        font-size: 36px;
        font-family: "Helvetica";
        text-anchor: start;
        fill: #000;
      }
      .rating {
        font-size: 30px;
        font-family: "Helvetica";
        text-anchor: start;
        fill: #000;
      }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
<<<<<<< HEAD
  
  <!-- Review text -->
=======

  <!-- Titre avec mise à ligne automatique -->
  <foreignObject x="50" y="100" width="${
    svgWidth - 20
  }" height="100"> <!-- Hauteur augmentée -->
  <div xmlns="http://www.w3.org/1999/xhtml" class="title" style="font-size: 50px; font-family: Helvetica; font-weight: bold; color: black; line-height: 1.2;">
    ${review.experience}
  </div>
</foreignObject>

  <!-- Lignes de Titre -->
>>>>>>> 0192d385890b6a3f6cf1d129398a3d2916e43eb4
  <g transform="translate(50, 100)">
    ${wrappedText
      .map(
        (line, index) =>
          `<text class="title" x="0" y="${index * 50}">${line}</text>`
      )
      .join("")}
  </g>

  <!-- Reviewer name -->
  <g transform="translate(50, 300)">
    <text class="review-text">${text_2} ${review.username}</text>
  </g>

  <!-- Rating stars -->
  <g transform="translate(50, 400)">
    <image href="${imageBase64Rating}" height="50" width="250" />
    <text class="rating" transform="translate(270, 35)">
      ${rating} / 5
    </text>
  </g>

  <!-- Number of reviews -->
  <g transform="translate(50, 500)">
    <text class="rating">${company.total_reviews} ${text_3}</text>
  </g>

  <!-- Company logo -->
  <g transform="translate(1000, 550)">
    <image href="${imageBase64Logo}" height="50" width="150" />
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
