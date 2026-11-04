# Reading attached documents

A person can attach a PDF or a text file to a chat and ask about it. The agent reads it with
`read_document`, which works with **no computer**: the file is read straight from storage and its
text is extracted inside the engine. This matters on a computer without Docker, where an agent has
no computer to run `pdftotext` on.

## What it reads

| File | How |
| --- | --- |
| PDF | Text of each page, read with pdf.js (`unpdf`). A page with no text, as in a scan, is empty. |
| Plain text, Markdown, CSV, JSON, HTML | Decoded as UTF-8, as it is. |

Anything else (Word, spreadsheets, images, audio, video) is not read yet, and the tool says so. A
PDF with no text layer at all comes back with a note to say it is a scan, so the agent does not
guess its contents. A password-protected PDF is refused.

## How an agent uses it

- With no file, `read_document` lists the documents attached in the conversation, newest first.
- With a file (its path from the attachment list, or its exact name) it returns the text. A PDF
  carries a `[page N]` marker before each page, so an answer can name its page.
- A long document comes in parts of 24 000 characters: call again with `offset` set to the
  `next_offset` it returned.

## Limits and safety

- Only a file attached **in this conversation** and belonging to the same person and Space can be
  read; one attached elsewhere is refused.
- A file over the attachment size limit is refused before it is read. A PDF is read up to 500
  pages, and for at most 60 seconds.
- A PDF is untrusted input. Its text is returned as data (`untrusted`), never as instructions, and
  a run that reads it is treated like one that read any other outside text.
- Runs that answer a messaging channel do not get the tool.

## Not done yet

Word and spreadsheet files, reading a document into the wiki as a source for the curator, and
reading a scanned PDF by recognising its text.
