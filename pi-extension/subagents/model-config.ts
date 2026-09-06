/**
 * Model configuration and resolution utilities
 */

export interface ModelOverrides {
  models?: Record<string, string>;
}

export interface ResolutionParams {
  explicit?: string;
  project?: string;
  global?: string;
  profile?: string;
  parent?: string;
  available: string[];
  trustedProject?: boolean;
}

/**
 * Loads model overrides from a JSON file path
 */
export function loadModelOverrides(configPath: string): ModelOverrides | null {
  try {
    // Using dynamic import to avoid issues with CommonJS modules
    const fs = require('fs') as typeof import('fs');
    
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    
    // Validate the structure - ensure it has a models property that is an object
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.models === 'object' && parsed.models !== null) {
      // Ensure models contains string keys and string values
      const models: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.models)) {
        if (typeof key === 'string' && typeof value === 'string') {
          models[key] = value;
        }
      }
      return { models };
    }
    
    return null;
  } catch (error) {
    // Ignore malformed files
    return null;
  }
}

/**
 * Resolves the appropriate model based on priority order:
 * explicit -> project (if trusted) -> global -> profile -> parent
 * Only returns models that are available in the available array
 */
export function resolveModel(params: ResolutionParams): string | undefined {
  const { explicit, project, global, profile, parent, available, trustedProject } = params;
  
  // Convert available array to Set for faster lookups
  const availableSet = new Set(available);
  
  // Build the priority chain, conditionally including project based on trust
  const priorityChain = [explicit];
  
  // Only add project if trustedProject is true or if trustedProject is undefined (backward compatibility)
  if ((trustedProject === true || trustedProject === undefined) && project) {
    priorityChain.push(project);
  }
  
  // Add remaining sources in order
  priorityChain.push(global, profile, parent);
  
  // Check each source in priority order
  for (const model of priorityChain) {
    if (model && availableSet.has(model)) {
      return model;
    }
  }
  
  // No available model found in the priority chain
  return undefined;
}