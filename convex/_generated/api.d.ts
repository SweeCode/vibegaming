/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as guestSessions from "../guestSessions.js";
import type * as leaderboard from "../leaderboard.js";
import type * as skillTree from "../skillTree.js";
import type * as upgrades from "../upgrades.js";
import type * as waveProgress from "../waveProgress.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  guestSessions: typeof guestSessions;
  leaderboard: typeof leaderboard;
  skillTree: typeof skillTree;
  upgrades: typeof upgrades;
  waveProgress: typeof waveProgress;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
