import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'license',
  group: 'Project',
  category: 'Project',
  title: 'License and disclaimer',
  subtitle: 'MIT licensed, and provided without warranty.',
  blocks: [
    { kind: 'heading', level: 2, text: 'License' },
    {
      kind: 'p',
      text: 'Copyright (c) 2026 Armaan Amoli. BabyPanda is released under the MIT Licence.',
    },
    {
      kind: 'code',
      lang: 'text',
      title: 'MIT License',
      code: 'Permission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.',
    },
    {
      kind: 'p',
      text: 'In plain terms: you may use, copy, modify and redistribute BabyPanda, including in commercial products, as long as the copyright notice and the licence text stay with it. The full text lives in [LICENSE](https://github.com/ArmaanAmoli/BabyPanda/blob/main/LICENSE) at the root of the repository.',
    },
    { kind: 'heading', level: 2, text: 'Disclaimer' },
    {
      kind: 'p',
      text: 'BabyPanda is an AI coding agent that can read and modify files and run shell commands on your machine. Its actions are driven by language-model output, which can be wrong or unpredictable.',
    },
    {
      kind: 'list',
      items: [
        'Use it at your own risk, and review what it does before approving actions.',
        'Work inside a git repository or keep backups of important files.',
        'Do not run it on systems or data you can’t afford to lose.',
        'You are responsible for how you use this software and for complying with all applicable laws. Do not use it for unlawful or harmful purposes.',
        'Your API keys stay on your machine. Use only keys and model providers you are permitted to use, and follow their terms.',
      ],
    },
    {
      kind: 'p',
      text: 'This software is provided "as is" without warranty of any kind. The author is not liable for any damage or loss arising from its use.',
    },
    { kind: 'heading', level: 2, text: 'Known limitations' },
    {
      kind: 'list',
      items: [
        '**NVIDIA NIM only:** the runtime endpoint and API key are hard-coded to the NVIDIA integration path; OpenAI, Anthropic, local models and other providers are not currently supported.',
        '**Experimental persistence:** migrations and schema are still evolving.',
        '**Local-first operation:** the application assumes a local filesystem, a local SQLite database and a local terminal.',
        '**Limited operational safeguards:** there is no production authentication, multi-user isolation or deployment guide yet.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Reporting a bug' },
    {
      kind: 'p',
      text: 'Open an issue on [GitHub](https://github.com/ArmaanAmoli/BabyPanda/issues) with the command you ran, your operating system, your Bun version, whether `IN_DEV_MODE` was enabled, and a redacted error log. Never include provider API keys.',
    },
  ],
};

export default page;
