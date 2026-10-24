# llms-txt-gen

[![CI](https://github.com/YusufBeratZengin/llms-txt-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/llms-txt-gen/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/llms-txt-gen)](https://www.npmjs.com/package/llms-txt-gen) [![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

[English](README.md) | Türkçe

Bir depodan ya da Markdown doküman klasöründen `llms.txt` (ve isteğe bağlı `llms-full.txt`) üretir, mevcut dosyayı doğrular.
Bağımlılığı yok, tamamen çevrimdışı çalışır, yapılandırma dosyası istemez.

```sh
npm i -g llms-txt-gen   # ya da: npx llms-txt-gen
llms-txt-gen ./docs --base-url https://example.com/docs --full --max-tokens 50000
llms-txt-gen check ./docs/llms.txt
```

## Demo

![node examples/demo.mjs çıktısı](docs/demo.svg)

`node examples/demo.mjs` komutunun gerçek çıktısı; araç [`examples/site`](examples/site) klasöründeki örnek dokümanlar üzerinde çalışır:

```text
# Acme Widgets

> Acme Widgets is a fictional widget toolkit used to demonstrate llms-txt-gen.

## Docs

- [Acme Widgets](https://docs.example.com/README): Acme Widgets is a fictional widget toolkit used to demonstrate llms-txt-gen.

## Api

- [Widget API](https://docs.example.com/api/widget): The Widget class renders a single widget and exposes render(), update() and destroy().

## Guides

- [Quickstart](https://docs.example.com/guides/quickstart): Install Acme Widgets and render your first widget in five minutes.
- [Theming](https://docs.example.com/guides/theming): Widgets read colors and spacing from a theme object, so one change restyles every widget.

## Optional

- [Changelog](https://docs.example.com/CHANGELOG): All notable changes to Acme Widgets are listed here.
```

## Kurulum

```sh
npm install --save-dev llms-txt-gen     # proje bağımlılığı olarak
npx llms-txt-gen --help                 # tek seferlik
```

Node.js 20 ya da üzeri gerekir. İlk npm yayınından önce depoyu klonlayıp `node bin/llms-txt-gen.mjs` ile çalıştırabilirsiniz.

## Kullanım

### CLI

```sh
llms-txt-gen [generate] [dizin] [seçenekler]   # llms.txt üretir (varsayılan komut)
llms-txt-gen check [dosya] [--strict]          # llms.txt doğrular
```

| Seçenek | Anlamı |
| --- | --- |
| `-o, --out <dosya>` | Çıktı yolu. Varsayılan: `<dizin>/llms.txt`. |
| `--stdout` | `llms.txt` dosyaya yazılmaz, ekrana basılır. |
| `--full` | `llms.txt` yanına `llms-full.txt` (tüm içerik birleşik) de yazar. |
| `--full-out <dosya>` | `llms-full.txt` yolu (`--full` anlamına gelir). |
| `--max-tokens <n>` | `llms-full.txt` dosyasını yaklaşık `n` tahmini token ile sınırlar (`--full` anlamına gelir). |
| `--base-url <url>` | Linklerin önüne eklenir. Verilmezse linkler her çıktı dosyasının klasörüne göredir (`--stdout`: girdi klasörü). |
| `--strip-ext` | Link yollarından `.md` / `.mdx` uzantısını atar (temiz URL sunan siteler için). |
| `--title`, `--description` | H1 başlığını ve özet blockquote'unu elle verir. |
| `--include <glob>` | Dahil edilecek dosyalar, tekrarlanabilir. Varsayılan `**/*.md`, `**/*.mdx`. |
| `--exclude <glob>` | Atlanacak dosyalar, tekrarlanabilir. Her zaman atlananlar: `node_modules/`, `.github/` gibi nokta ile başlayan klasörler, `llms.txt`, `llms-full.txt` ve çıktı dosyaları. |
| `--optional <glob>` | `Optional` bölümüne girecek dosyalar, tekrarlanabilir. Varsayılan kümenin (`CHANGELOG*`, `CODE_OF_CONDUCT*`, `CONTRIBUTING*`, `SECURITY*`, `LICENSE*`, `README.*.md`) yerine geçer. |

Glob'lar `*`, `**`, `?`, `{a,b}` ve `[abc]` destekler. İçinde `/` olmayan desen her derinlikte eşleşir (`.gitignore` gibi); sondaki `/` bütün bir klasör demektir.

`check`, hata yoksa `0`, hata varsa `1` (`--strict` ile uyarılarda da), dosya okunamazsa `2` ile çıkar. Diğer komutlar kullanım hatasında `2` döner.

### Kütüphane

```js
import { generate, check } from 'llms-txt-gen';

const { llmsTxt, llmsFull, fullTokens, truncated } = generate({
  dir: './docs',
  baseUrl: 'https://example.com/docs',
  full: true,
  maxTokens: 50_000,
});
console.log(check(llmsTxt)); // { ok: true, errors: [], warnings: [] }
```

Ayrıca dışa açılanlar: `scanFiles`, `buildUrl`, `estimateTokens`, `parseFrontMatter`, `extractMeta`, `stripInline`, `globToRegExp`, `createMatcher`. Paket JSDoc tipleri içerir ve `tsc --strict` ile denetlenir.

## Örnekler

[`examples/`](examples) klasörüne bakın. Yukarıdaki çıktıyı `node examples/demo.mjs` ile yeniden üretebilirsiniz.

## Nasıl çalışır

- **Proje başlığı ve özeti:** önce `--title` / `--description`, sonra kök README'nin H1'i / `package.json` açıklaması / README'nin ilk paragrafı, en sonda klasör adı.
- **Sayfa başlığı ve not:** front matter'daki `title` / `description`; yoksa ilk H1 ve ilk düz yazı paragrafı (kod blokları, listeler, alıntılar, tablolar ve rozet satırları atlanır). Notlar 160 karakterde kesilir.
- **Bölümler:** dosyanın ilk klasörü bölüm adı olur (`guides/x.md`, `Guides` altına girer); en üstteki dosyalar `Docs` altına girer. Front matter'da `section: Ad` bunu değiştirir. Front matter'da `optional: true` ya da `--optional` eşleşmesi sayfayı her zaman en sonda olan `Optional` bölümüne taşır. `order: n` sıralar, `draft: true` sayfayı atlar. Çıktı her seferinde aynıdır.
- **llms-full.txt:** her sayfa `# Başlık`, bir `Source:` satırı ve gövdesiyle (front matter çıkarılmış) `llms.txt` ile aynı sırada eklenir; yani `Optional` sayfalar en sondadır.
- **`--max-tokens`:** başlangıç başlığı ve özet bütçeye dahildir; sığmazlarsa üretim hata verir. Sığdığı sürece sayfalar bütün olarak alınır. Sığmayan ilk sayfa (en az yaklaşık 100 token kaldıysa) satır sınırından kesilir ve HTML yorumuyla işaretlenir; sonrası bırakılır. `llms.txt` yine her sayfayı listeler.
- **Token tahmini:** ASCII için yaklaşık 4, diğer karakterler için 2 karakter = 1 token. Model tokenizer'ı değil, kaba bir tahmindir; pay bırakın.
- **check:** hatalar: H1 yok ya da ilk öğe değil, bölüm içindeki liste öğesinin `[metin](url)` linkiyle başlamaması, boş link metni ya da URL, URL içinde boşluk. Uyarılar: özet blockquote yok, birden çok H1, 125 karakterden uzun H1, boş ya da yinelenen bölüm, H3+ başlıklar, liste arasında serbest metin, yinelenen URL, iki nokta olmadan not, `Optional` yazımı ya da yeri.

## Standart hakkında notlar ve belirsizlikler

Biçim, 2026-10-23 tarihinde okunan [llmstxt.org](https://llmstxt.org/) önerisini izler: yalnız H1 zorunludur; ardından isteğe bağlı blockquote, başlıksız ayrıntı metni ve `- [ad](url): not` biçiminde H2 dosya listeleri gelir; `Optional`, atlanabilecek linkleri işaretler. Araç resmî bir test paketiyle doğrulanmadı ve öneri değişebilir. Belirsiz ya da öneride yer almayan noktalar ve aracın bunlarla ne yaptığı:

- **Göreli linkler.** Önerideki örnek mutlak URL kullanır, göreli linkten söz etmez. `--base-url` verilmezse araç göreli yol üretir; yayınlayacağınız dosya için `--base-url` verin.
- **`llms-full.txt`.** Yaygın bir gelenek, baktığım öneri metninde yok. Buradaki yerleşimi benim seçimim.
- **Birden çok H1, H3+ başlıklar, dosya listesi bölümünde serbest metin.** Öneride tanımlı değil. `check` bunları hata değil uyarı olarak bildirir.
- **Özet blockquote.** Öneride isteğe bağlı; önerilen biçim olduğu için eksikse `check` uyarır.
- **`Optional` yazımı.** Yalnız tam `Optional` adı özel sayılır; farklı büyük/küçük harf için uyarılır.
- **Bölüm adları ve sırası.** Klasöre göre bu araç belirler; öneri bir şey dayatmaz.

## Sınırlamalar

- Yalnız Markdown (`.md`, `.mdx`) okunur. MDX bileşenleri ve JSX olduğu gibi kalır.
- Front matter, YAML'ın düz `anahtar: değer` alt kümesidir (iç içe yapı, liste, çok satırlı değer yok).
- Linkler Markdown dosyalarına işaret eder; sitenizdeki yayın adreslerine eşlemek `--base-url` ve `--strip-ext` ile sizin işiniz.
- Ağ erişimi ve telemetri yok. Linkler canlı olarak kontrol edilmez.

## Geliştirme

```sh
git clone https://github.com/YusufBeratZengin/llms-txt-gen.git
cd llms-txt-gen
npm ci
npm run check    # lint + typecheck + kapsamlı testler
npm run demo     # docs/demo.svg dosyasını yeniden üretir
```

## Katkı

[CONTRIBUTING.md](CONTRIBUTING.md) ve [Davranış Kuralları](CODE_OF_CONDUCT.md) dosyalarına bakın. Güvenlik bildirimleri: [SECURITY.md](SECURITY.md).

## Lisans

[MIT](LICENSE)
