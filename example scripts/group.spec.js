import { test, expect } from '@playwright/test';

test.describe('Свод отчетов', () => {

    // Выполняется один раз перед всеми тестами в группе
    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('https://localhost/sko/ru/');

        // Авторизация
        await page.locator('#userName').fill('Администратор');
        await page.locator('#userPassword').fill('H');
        await page.getByRole('button', { name: 'Войти' }).click();

        // Сохраняем страницу для последующих тестов
        test.info().annotations.push({ type: 'page', description: 'shared' });
        global.page = page; // ⚠️ используем глобальную ссылку
    });

    // После всех тестов — закрываем страницу
    test.afterAll(async () => {
        await global.page?.close();
    });

    // ---- Подтесты ----

    test('Открытие формы Ф. 0503737', async () => {
        const page = global.page;
        await page.getByText('Ф. 0503737').nth(2).dblclick();
        await close(page);
    });

    test('Работа с Нормативно-справочной информацией', async () => {
        const page = global.page;
        await page.getByText('Нормативно-справочная').click();
        await page.waitForTimeout(100);
        await page.getByText('Бюджеты').click();
        await page.waitForTimeout(100);
        await doubleClickRandomRow(page);
        await closeButton(page, 'ФормаЗаписатьИЗакрыть');
    });

    test('Анализ данных и формирование отчета', async () => {
        const page = global.page;
        await page.getByText('Анализ данных').click();
        await page.waitForTimeout(500);
        await page.locator('#cmd_0_0_txt').click();
        await page.waitForTimeout(200);
        await close(page);

        await page.getByText('Комплект отчетности').click();
        await page.waitForTimeout(200);
        await page.locator('#cmd_2_0_txt').click();
        await page.waitForTimeout(1000);
        await page.locator('a[id^="form"][id$="СформироватьОтчет"]').last().click();
        await page.waitForTimeout(1000);
        await close(page);
    });
});


async function closeButton(page, name) {
    const elem = await page.locator(`a[id$="_${name}"]`);
    await elem.waitFor();

    const elems = await elem.elementHandles();

    console.log(name, elems.length)

    for (const btn of elems) {
        const id = await btn.evaluate(el => el.id);
        if (new RegExp(`^form\\d+_${name}$`).test(id)) {
            await btn.click();
            break; // кликнули первый подходящий
        }
    }
}

async function doubleClickRandomRow(page){
    // Получаем все строки
    const rows = await page.locator('div.gridBody div.gridLine').all();
    if (rows.length === 0) {
        console.log(`В списке нет строк`);
        return
    }

    await page.waitForTimeout(200);

    // Фильтруем только видимые строки
    const visibleRows = [];
    for (const row of rows) {
        if (await row.isVisible()) {
            // const text = await row.innerText();
            // console.log(text);
            visibleRows.push(row);
        }
    }

    // Выбираем случайную из видимых
    const randomIndex = Math.floor(Math.random() * visibleRows.length);
    const targetRow = visibleRows[randomIndex];

    // Двойной клик
    await targetRow.dblclick({ timeout: 5000 });

    console.log(`Выполнен двойной клик на строку с индексом: ${randomIndex} из ${rows.length}`);
}

async function close(page) {
    try {
        await page.locator('[id^="VW_page"][id$="headerTopLine_cmd_CloseButton"]').last().click({ timeout: 10000 });
    } catch (error) {
        console.warn('⚠️ Кнопка закрытия не найдена или не кликабельна:', error.message);
    }
}
