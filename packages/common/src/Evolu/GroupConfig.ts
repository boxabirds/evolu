/**
 * Configuration extension for group support in Evolu.
 */

import type { Config } from "./Config.js";

/**
 * Extended configuration that includes group support options.
 */
export interface GroupConfig extends Config {
  /**
   * Enable group functionality. When true, group tables will be created
   * and group APIs will be available.
   * 
   * The default value is: `false`.
   */
  readonly enableGroups?: boolean;
}

/**
 * Type guard to check if config has group support enabled
 */
export const hasGroupsEnabled = (config: Config): config is GroupConfig => {
  return 'enableGroups' in config && (config as GroupConfig).enableGroups === true;
};