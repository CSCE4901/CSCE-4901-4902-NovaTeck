const DFW_CITIES = ['Dallas', 'Fort Worth', 'Plano', 'Irving', 'Richardson', 'Frisco', 'McKinney', 'Denton', 'Grapevine', 'Carrollton', 'Arlington', 'Addison', 'Allen', 'Garland', 'Southlake', 'Lewisville', 'Coppell', 'Flower Mound', 'The Colony', 'Euless', 'Bedford', 'Hurst', 'Keller', 'Mansfield', 'Burleson', 'Wylie', 'Prosper', 'Colleyville', 'Westlake', 'Roanoke'];

export function splitLocations(location) {
  const segments = [];
  let part = '', depth = 0;
  for (const character of location || '') {
    if (character === '(') depth++;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[;/|]/.test(character)) { segments.push(part); part = ''; }
    else part += character;
  }
  segments.push(part);
  return [...new Set(segments.flatMap(segment => segment.split(/(?<=\b[A-Z]{2}),\s*(?=[A-Z][a-z])|(?<=Washington D.C.),\s*/)).map(place => place.trim()).filter(Boolean))];
}

export function isDfwLocation(place) {
  if (/\b(?:DFW|Dallas[–-]Fort Worth)\b/i.test(place)) return true;
  return DFW_CITIES.some(city => {
    // State-free feed locations are valid, but Arlington needs Texas to disambiguate.
    const suffix = city === 'Arlington' ? '\\s*,?\\s+(?:TX|Texas)\\b' : '(?:\\s*,?\\s+(?:TX|Texas)\\b|\\s*$)';
    return new RegExp(`^${city}${suffix}`, 'i').test(place);
  });
}

export function compactLocation(location) {
  const places = splitLocations(location);
  if (!places.length) return 'Location not provided';
  if (places.length < 2) return location;
  return `${places.find(isDfwLocation) || places[0]} +${places.length - 1} more`;
}
