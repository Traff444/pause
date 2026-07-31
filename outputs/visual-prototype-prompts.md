# Четыре промта для визуального прототипа «ПАУЗА»

Это не технические макеты всех состояний. Это четыре главных визуала — по одному для каждой вкладки tab bar. Детальная логика, редкие состояния и переходы остаются в `developer-spec-v3.md`.

## Единое правило для всех четырёх картинок

```text
High-fidelity contemporary iOS-style mobile PWA interface for a Russian smoking-reduction and quit-support app named “ПАУЗА”. Portrait 390x844 px, iPhone safe areas, no phone device mockup. Exact approved visual language: warm off-white background #F8F7F3, black #060606 text, saturated royal blue #0647B7 accent. Use a clean modern sans-serif similar to Manrope / SF Pro Display: section labels are bold uppercase blue, titles are bold black, body text is regular black or warm grey. Generous empty space, precise alignment, thin blue progress lines, white rounded cards with 26px corners and restrained soft shadows, black outline icons in pale-grey circular containers. Main action is a large royal-blue circular button with white uppercase text. Bottom tab bar is a large rounded royal-blue panel, white line icons and white labels, active item marked with a subtle white ring around the icon. No condensed poster typography, no illustrated hands, no hand-drawn ink, no gradients, no green, no cigarette photos, no skulls, no emoji, no red warning states. Russian UI text must be legible and concise. Bottom navigation always has exactly four tabs: Сегодня, План, Здоровье, Статистика. No lorem ipsum.
```

## 1. Вкладка «Сегодня» — наблюдение

```text
Create the Today tab on day 4 of the first 7-day observation period. Bottom navigation visible; Сегодня is active with a white ring around its icon.

Top: blue uppercase label “НАБЛЮДЕНИЕ”. Below, bold black title “День 4 из 7”; on the right muted text “Осталось 3 дня”. Under it, one thin horizontal royal-blue progress line filled 4/7 with light-grey remainder. Small outline settings gear at top right, no avatar.

Main white rounded card with two rows: “Количество сигарет” with large black number “6”; divider; “Последняя сигарета” with bold “18 мин. назад”. Each row has a simple black outline icon in a pale-grey circle.

Center: one dominant large royal-blue circular button with white uppercase text “ИДУ КУРИТЬ”. Under it, a thin black upward arrow and text “Нажми прямо перед сигаретой.” No history timeline, no timestamps, no extra illustration. Use the shared style.
```

## 2. Вкладка «План» — путь из 16 недель

```text
Create the Plan tab. Bottom navigation visible; План is active with a white ring around its icon.

Top: blue uppercase section label “ТВОЙ ПУТЬ”. Bold black title “Неделя 4 из 16”. Smaller muted subtitle “Ты тренируешь паузу между сигаретами.” Use only Manrope / SF Pro Display, never condensed typography.

Below: a compact white rounded accordion card “Как работает путь” with a chevron; it is collapsed. Then a vertically scrollable roadmap made from compact white rounded accordion cards, visually rich but calm. Show the first six weeks within the viewport and imply more below.

Completed compact cards: a royal-blue checkmark icon and text “Неделя 1 · Наблюдаем ритм”, “Неделя 2 · Начинаем первую паузу”, “Неделя 3 · Закрепляем новый ритм”.

Current Week 4 card is expanded and clearly stronger: royal-blue outlined status circle, blue label “СЕЙЧАС”, title “Неделя 4 · Тренируем паузу”, large black “Сегодня цель-пауза: 38 минут”, muted “До следующей недели: 4 дня”, one friendly line “Ты уже прошёл 3 недели.” and a small upward chevron.

Below it, compact future cards: “Неделя 5 · Укрепляем устойчивость” and “Неделя 6 · Замечаем момент выбора”, each with a slim grey outline status circle and a down chevron. At the bottom edge, make it visually clear that the user can scroll through the complete 16-week plan. No empty whitespace, no separate timeline of dots, no locked content, no graphs, timers, poster graphics, or route illustrations. Use the shared style.
```

## 3. Вкладка «Здоровье» — деньги и маленькое действие

```text
Create the Health tab after the baseline week. Bottom navigation visible; Здоровье is active with a white ring around its icon.

Top: blue uppercase label “ЗДОРОВЬЕ”. Bold black title “36 сигарет не выкурено”. Muted subline “Примерно сэкономлено: 900 ₽”.

White rounded personal-goal card: small blue label “ЦЕЛЬ”, title “Новый набор инструментов”, large black text “900 ₽ из 5 000 ₽”, thin royal-blue progress line at 18%.

Below, one white rounded action card with a simple outlined movement icon in a pale-grey circle: small blue label “МИКРОШАГ ДЛЯ СЕБЯ”, bold black “5 минут движения”, outlined pill button “ОТКРЫТЬ ВИДЕО”. No illustrations, no grid, no health claims, no green. Use the shared style.
```

## 4. Вкладка «Статистика» — движение вперёд

```text
Create the Statistics tab after several weeks of reduction. Bottom navigation visible; Статистика is active with a white ring around its icon.

Top: blue uppercase label “СТАТИСТИКА”. Directly under it, a compact white segmented control with “Неделя” active in royal blue, “Месяц”, “Всё время” in black-grey.

Main bold black statement: “На 42 сигареты меньше, чем в первую неделю”.

White rounded chart card: seven clean royal-blue vertical bars labelled Пн–Вс, bars gradually reducing; very thin light-grey grid lines. Below, a second compact white card: small blue label “СРЕДНЯЯ ПАУЗА”, large black “1 ч 20 мин”, muted comparison “В начале было 25 мин”.

Keep generous empty space. No dashboard overload, no red bars, no history timeline, no poster graphics. Use the shared style.
```
