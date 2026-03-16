Server dictionaries live in this directory.

Supported dictionary layouts:

1. JSON file dictionary

- Put a `.json` file directly in this folder.
- The filename without extension becomes the dictionary name in settings.

2. MDX/MDD package dictionary

- Put the package in its own subfolder.
- The subfolder name becomes the dictionary name in settings.
- The subfolder must include at least one `.mdx` file.
- If a matching `.mdd` file exists, css/js/image resources will also be served.

Example:

```
dictionaries/
  oxfordstu_no_audio/
    oxfordstu.mdx
    oxfordstu.mdd
    oxfordstu.css
    oxfordstu.js
```

Supported formats:

1. Object map

```json
{
  "hello": [
    {
      "partOfSpeech": "interjection",
      "language": "English",
      "definitions": [
        {
          "definition": "A greeting.",
          "examples": ["Hello, world."]
        }
      ]
    }
  ]
}
```

2. Entry array

```json
[
  {
    "word": "hello",
    "aliases": ["Hello"],
    "results": [
      {
        "partOfSpeech": "interjection",
        "language": "English",
        "definitions": [
          {
            "definition": "A greeting.",
            "examples": ["Hello, world."]
          }
        ]
      }
    ]
  }
]
```

After adding or replacing files here, restart the `readest-client` container so
the API can pick up the new dictionary list.
