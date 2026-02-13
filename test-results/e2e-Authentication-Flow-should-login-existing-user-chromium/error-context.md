# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Register" [level=1] [ref=e5]
  - paragraph [ref=e6]: Create a new account
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]: Username
      - textbox "Username" [ref=e10]:
        - /placeholder: Enter username
    - generic [ref=e11]:
      - generic [ref=e12]: Password
      - textbox "Password" [ref=e13]:
        - /placeholder: Enter password
    - generic [ref=e14]:
      - generic [ref=e15]: Confirm Password
      - textbox "Confirm Password" [ref=e16]:
        - /placeholder: Confirm password
    - button "Register" [ref=e17] [cursor=pointer]
  - paragraph [ref=e18]:
    - text: Already have an account?
    - link "Login here" [ref=e19] [cursor=pointer]:
      - /url: /login
```