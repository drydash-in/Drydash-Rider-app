// constants/productImages.ts
import { S3_IMAGES_BASE_URL } from "./apiConfig";

const S3_BASE = S3_IMAGES_BASE_URL;

export const productImages: Record<string, any> = {
  /* ===================== LAUNDRY ===================== */
  "w_f_wearable.jpg": { uri: `${S3_BASE}w_f_wearable.jpg` },
  "w_f_non-wearable.jpg": { uri: `${S3_BASE}w_f_non-wearable.jpg` },
  "w_i_wearable.jpg": { uri: `${S3_BASE}w_i_wearable.jpg` },
  "w_i_non-wearable.jpg": { uri: `${S3_BASE}w_i_non-wearable.jpg` },

  /* ===================== DRY CLEAN – CLOTHES ===================== */
  "shirt.png": { uri: `${S3_BASE}shirt.png` },
  "jeans.png": { uri: `${S3_BASE}jeans.png` },
  "trouser.png": { uri: `${S3_BASE}trouser.png` },
  "blazer.png": { uri: `${S3_BASE}blazer.png` },
  "3_pc_suit.png": { uri: `${S3_BASE}3_pc_suit.png` },
  "2_pc_suit.png": { uri: `${S3_BASE}2_pc_suit.png` },
  "longblazer.png": { uri: `${S3_BASE}longblazer.png` },
  "hoodie.png": { uri: `${S3_BASE}hoodie.png` },
  "winter_jacket.jpg": { uri: `${S3_BASE}winter_jacket.jpg` },

  "heavysaree.png": { uri: `${S3_BASE}heavysaree.png` },
  "mediumsaree.png": { uri: `${S3_BASE}mediumsaree.png` },
  "saree.png": { uri: `${S3_BASE}saree.png` },
  "blouse.png": { uri: `${S3_BASE}blouse.png` },
  "heavy_blouse.webp": { uri: `${S3_BASE}heavy_blouse.webp` },

  "lehenga.png": { uri: `${S3_BASE}lehenga.png` },
  "mediumlehenga.png": { uri: `${S3_BASE}mediumlehenga.png` },
  "heavy_lehenga.jpg": { uri: `${S3_BASE}heavy_lehenga.jpg` },

  "dress.png": { uri: `${S3_BASE}dress.png` },
  "heavy_dress.jpg": { uri: `${S3_BASE}heavy_dress.jpg` },
  "gown.jpg": { uri: `${S3_BASE}gown.jpg` },
  "heavy_gown.jpg": { uri: `${S3_BASE}heavy_gown.jpg` },

  "dupatta.jpg": { uri: `${S3_BASE}dupatta.jpg` },
  "heavy_duptta.jpg": { uri: `${S3_BASE}heavy_duptta.jpg` },

  "kurta_pajama.jpg": { uri: `${S3_BASE}kurta_pajama.jpg` },
  "shwal.jpg": { uri: `${S3_BASE}shwal.jpg` },
  "cardigin.jpg": { uri: `${S3_BASE}cardigin.jpg` },
  "srug.jpg": { uri: `${S3_BASE}srug.jpg` },

  "leather_jacket.jpg": { uri: `${S3_BASE}leather_jacket.jpg` },
  "belt.jpg": { uri: `${S3_BASE}belt.jpg` },
  "leather_belt.webp": { uri: `${S3_BASE}leather_belt.webp` },

  /* ===================== DRY CLEAN – BEDDING ===================== */
  "pillow_cover.jpg": { uri: `${S3_BASE}pillow_cover.jpg` },
  "large_pillow.jpg": { uri: `${S3_BASE}large_pillow.jpg` },
  "small_pillow.jpg": { uri: `${S3_BASE}small_pillow.jpg` },

  "blanket(single).jpg": { uri: `${S3_BASE}blanket(single).jpg` },
  "double_blanket.jpg": { uri: `${S3_BASE}double_blanket.jpg` },

  "Druvet_single.jpg": { uri: `${S3_BASE}Druvet_single.jpg` },
  "Druvet_double.jpg": { uri: `${S3_BASE}Druvet_double.jpg` },

  "Quilt_single.jpg": { uri: `${S3_BASE}Quilt_single.jpg` },
  "Quilt_double.jpg": { uri: `${S3_BASE}Quilt_double.jpg` },

  "bed_cover_single.jpg": { uri: `${S3_BASE}bed_cover_single.jpg` },
  "bed_cover_double.jpg": { uri: `${S3_BASE}bed_cover_double.jpg` },
  "bed_sheet_single.jpg": { uri: `${S3_BASE}bed_sheet_single.jpg` },
  "bed_sheet_double.jpg": { uri: `${S3_BASE}bed_sheet_double.jpg` },

  /* ===================== DRY CLEAN – BAGS ===================== */
  "handbag_small.jpeg": { uri: `${S3_BASE}handbag_small.jpeg` },
  "handbag_medium.jpg": { uri: `${S3_BASE}handbag_medium.jpg` },
  "handbag_large.jpg": { uri: `${S3_BASE}handbag_large.jpg` },
  "sports_bag.jpg": { uri: `${S3_BASE}sports_bag.jpg` },
  "Leatherbag_small.webp": { uri: `${S3_BASE}Leatherbag_small.webp` },
  "leather_bag_large.jpg": { uri: `${S3_BASE}leather_bag_large.jpg` },

  /* ===================== SHOE SPA ===================== */
  "sportsshoes.png": { uri: `${S3_BASE}sportsshoes.png` },
  "leather_shoes.jpg": { uri: `${S3_BASE}leather_shoes.jpg` },
  "suedeshoes.png": { uri: `${S3_BASE}suedeshoes.png` },
  "boots.png": { uri: `${S3_BASE}boots.png` },
  "stilettos.png": { uri: `${S3_BASE}stilettos.png` },
  "sliders.png": { uri: `${S3_BASE}sliders.png` },
  "sandals.png": { uri: `${S3_BASE}sandals.png` },

  /* ===================== FALLBACK ===================== */
  fallback: { uri: `${S3_BASE}sportsshoes.png` },
};
