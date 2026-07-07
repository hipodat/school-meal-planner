export function isValidYear(year) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100;
}

export function isValidMonth(month) {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

export function isValidEduCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{1,10}$/.test(code);
}

export function isValidSchoolCode(code) {
  return typeof code === "string" && /^\d{1,20}$/.test(code);
}

export function isValidYmdDate(value) {
  return typeof value === "string" && /^\d{8}$/.test(value);
}

export function validateOptionalSchoolCodes({ eduCode, schoolCode }) {
  if (!eduCode && !schoolCode) return null;
  if (isValidEduCode(eduCode) && isValidSchoolCode(schoolCode)) return null;
  return "학교 코드 형식이 올바르지 않습니다.";
}

export function validateMenuParams({ year, month, eduCode, schoolCode }) {
  if (!isValidYear(year) || !isValidMonth(month)) {
    return "year는 2020~2100, month는 1~12 범위여야 합니다.";
  }
  return validateOptionalSchoolCodes({ eduCode, schoolCode });
}
