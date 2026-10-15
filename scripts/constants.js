/** Shared constants (kept separate so the other scripts can import them in any order). */
export const MODULE_ID = "dxcufgbs-canvas-effects";
/** Scene flag holding the painted effect areas: flags[MODULE_ID].areas = {[id]: area}. */
export const FLAG = "areas";
/** Name of the canvas layer and of its Scene Controls group. */
export const LAYER = "dxcfxAreas";
/**
 * Where the effects are drawn in the primary canvas group: above the map, tiles and drawings
 * (SORT_LAYERS.DRAWINGS = 600), below the tokens (SORT_LAYERS.TOKENS = 700).
 */
export const SORT_LAYER = 650;
/**
 * Where layers marked "Above the tokens" are drawn (weather over everyone's heads): above the
 * tokens (700), below Foundry's own weather (SORT_LAYERS.WEATHER = 1000).
 */
export const OVER_SORT_LAYER = 900;
