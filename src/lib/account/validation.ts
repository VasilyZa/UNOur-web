export function validateCredentials(
  username: string,
  password: string,
  register: boolean,
): string {
  if (!/^[A-Za-z0-9_\-\p{Script=Han}]{3,24}$/u.test(username.trim()))
    return '用户名需为 3–24 个汉字、英文字母、数字、下划线或短横线。'
  if ([...password].length < 8 || [...password].length > 14)
    return '密码需为 8–14 个字符。'
  if (!register && !password) return '请输入密码。'
  return ''
}
