export const DecimalTypePattern = /^DECIMAL\((\d+),\s*(\d+)\)$/;

export const ListTypePattern = /^LIST<(.+)>$/;

export const SetTypePattern = /^SET<(.+)>$/;

export const MapTypePattern = /^MAP<(.*)>$/;

export const GeographyTypePattern = /^GEOGRAPHY\((.*)\)$/i;

export const VectorTypePattern = /^VECTOR<(\d+),(.+)>$/;

function splitTopLevelTypeArguments(typeArguments: string): string[] {
  const parts: string[] = [];
  let current = '';
  let angleBracketDepth = 0;
  let parenthesisDepth = 0;

  for (const char of typeArguments) {
    if (char === ',' && angleBracketDepth === 0 && parenthesisDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    if (char === '<') {
      angleBracketDepth += 1;
    } else if (char === '>') {
      angleBracketDepth -= 1;
    } else if (char === '(') {
      parenthesisDepth += 1;
    } else if (char === ')') {
      parenthesisDepth -= 1;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function parseMapTypeSignature(type: string): { keyType: string; valueType: string } | undefined {
  const matched = type.match(MapTypePattern);
  if (!matched) {
    return undefined;
  }

  const [keyType, valueType, ...extraTypes] = splitTopLevelTypeArguments(matched[1]);
  if (!keyType || !valueType || extraTypes.length > 0) {
    return undefined;
  }

  return { keyType, valueType };
}

export const ForwardEdgePattern = /\((.*?)\)-\[(.*?)\]->\((.*?)\)/;

export const BackwardEdgePattern = /\((.*?)\)<-\[(.*?)\]-\((.*?)\)/;

export const UndirectedEdgePattern = /\((.*?)\)~\[(.*?)\]~\((.*?)\)/;
