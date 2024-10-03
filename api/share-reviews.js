const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

path.resolve(process.cwd(), "fonts", "fonts.conf");
path.resolve(process.cwd(), "fonts", "Helvetica Bold.ttf");

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
  const roundedValues = [
    { max: 0, value: 0 },
    { max: 1, value: 1 },
    { max: 1.7, value: 1.5 },
    { max: 2, value: 2 },
    { max: 2.7, value: 2.5 },
    { max: 3, value: 3 },
    { max: 3.7, value: 3.5 },
    { max: 4, value: 4 },
    { max: 4.7, value: 4.5 },
    { max: 5, value: 5 },
  ];
  return roundedValues.find((item) => x <= item.max)?.value || x;
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
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return `data:image/png;base64,${Buffer.from(response.data, "binary").toString(
    "base64"
  )}`;
}

async function handler(req, res) {
  const { data, locale } = req.query;

  if (!data || !locale) {
    return res
      .status(400)
      .json({ error: "Missing required query parameters 'data' or 'locale'." });
  }

  const supportedLocales = ["fr", "de", "pt", "nl", "it", "es", "en"];
  if (!supportedLocales.includes(locale)) {
    return res.status(404).json({ error: "Locale not supported." });
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

  if (!review || !company) {
    return res.status(404).json({ error: "Company or review data not found." });
  }

  const ratingIndex = Math.min(Math.floor(review.note), 4);
  const ratingText = ratings[ratingIndex];
  const rating = roundToHalf(review.note);

  const imageURLLogo = `${CDN_BASE_URL}/star-evaluator-bleu.png`;
  const imageURLRating = `${CDN_BASE_URL}/ratings/${rating}.png`;

  let imageBase64Logo, imageBase64Rating;
  try {
    [imageBase64Logo, imageBase64Rating] = await Promise.all([
      fetchImageToBase64(imageURLLogo),
      fetchImageToBase64(imageURLRating),
    ]);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error converting images to Base64." });
  }

  const wrappedCompanyName = wrapText(company.name, 20);

  const svgWidth = 600;
  const svgHeight = 450;

  const svgImage = `
    <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: "Helvetica";
            src: url("${path.resolve(
              process.cwd(),
              "fonts",
              "Helvetica Bold.ttf"
            )}") format("truetype");
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
      <image 
      href="${imageBase64Logo}" 
      x="40" 
      y="40" 
      width="50" 
      height="50"/>
      <text 
      class="title" 
      x="120" 
      y="80">${text_1}</text>
      <text class="title_2" x="280" y="80">${company.name}</text>
      <image href="${imageBase64Rating}" x="400" y="120" width="100" height="100"/>
      <text class="rating" x="120" y="120">${ratingText} ${rating}</text>
      <text class="rating" x="120" y="160">${text_2} ${
    review.total_reviews
  } ${text_3}</text>
    </svg>
  `;

  const svgBuffer = Buffer.from(svgImage);

  const pngImage = await sharp(svgBuffer).png().toBuffer();
  res.set("Content-Type", "image/png");
  res.send(pngImage);
}

module.exports = handler;
