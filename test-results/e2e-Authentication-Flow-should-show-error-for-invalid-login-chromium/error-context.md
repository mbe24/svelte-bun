# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Login" [level=1] [ref=e5]
  - paragraph [ref=e6]: Sign in to your account
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]: Username
      - textbox "Username" [ref=e10]:
        - /placeholder: Enter username
    - generic [ref=e11]:
      - generic [ref=e12]: Password
      - textbox "Password" [ref=e13]:
        - /placeholder: Enter password
    - button "Login" [ref=e14] [cursor=pointer]
  - paragraph [ref=e15]:
    - text: Don't have an account?
    - link "Register here" [ref=e16] [cursor=pointer]:
      - /url: /register
```