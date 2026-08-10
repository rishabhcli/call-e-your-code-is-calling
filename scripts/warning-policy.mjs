const WARNING_PATTERN =
  /(?:^|[\s[(])(?:warn(?:ing)?s?|[A-Za-z]*warning|deprecat(?:ed|ion|ions)|⚠)(?=$|[\s:.,;\])])/iu;

export function findWarningLines(output) {
  return output.split(/\r?\n/u).filter((line) => WARNING_PATTERN.test(line));
}
