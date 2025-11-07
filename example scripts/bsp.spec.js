import { test, expect } from '@playwright/test';

// тесты выполняются последовательно
test.describe.configure({ mode: 'serial' });

test.describe('Тест БСП', () => {
    // Выполняется один раз перед всеми тестами в группе
    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('http://localhost/bsp/ru_RU/');
        await page.locator('#userName').fill('Администратор');
        await page.locator('#userPassword').fill('123');
        await page.getByRole('button', { name: 'Войти' }).click();

        // Сохраняем страницу для последующих тестов
        test.info().annotations.push({ type: 'page', description: 'shared' });
        global.page = page;
    });

    test.afterAll(async () => {
        await global.page?.close();
    });


    test('отчет анализ активности пользователе', async () => {
        await global.page.locator('[id$="themesCell"]').getByText('Администрирование').click();
        await global.page.locator('#funcPanel_container').getByText('Отчеты администратора').click();
        await global.page.locator('[id$="_Основное_div"]').getByText('Анализ активности пользователей').click();
        await buttonClick(global.page, 'СформироватьОтчет');
        await global.page.waitForTimeout(1000);
        await closeForm(global.page);
    });
    test('открыть валюты', async () => {
        test.setTimeout(60_000); // секунд только для этого теста

        await global.page.locator('[id$="themesCell"]').getByText('Справочники').click();
        await global.page.locator('#funcPanel_container').locator('.functionItemBox').getByText('Валюты').click();
        await global.page.waitForTimeout(100);
        await doubleClickRandomRow(global.page);
        await buttonClick(global.page, 'ФормаЗаписатьИЗакрыть');

        const count = await global.page.locator('id$="_CommandButtonOK"');
        if(count > 0) {
            await global.page.locator('id$="_CommandButtonOK"').click();
            await closeButton(global.page, 'ФормаЗаписатьИЗакрыть')
        }
    });
    test('создать документ', async () => {
        await global.page.locator('[id$="themesCell"]').getByText('подсистемы (часть 2)').click();
        await global.page.locator('#funcPanel_container').locator('#cmd_0_6_txt').click();
        await buttonClick(global.page, 'ФормаСоздать');

        const name = randomString();
        await global.page.getByRole('textbox', { name: 'Сумма документа' }).pressSequentially("1212");
        await global.page.locator('[id^="form"]').locator('[id$="_Партнер_DLB"]').last().click();
        await global.page.getByText('Показать все').first().click();
        await global.page.waitForTimeout(100);
        await global.page.locator('[id^="grid_"]').getByText('Пилигрим ООО').last().dblclick({ timeout: 500 });
        await global.page.locator('[id^="form"]').locator('[id$="_Организация_DLB"]').last().click();
        await global.page.getByText('Показать все').first().click();
        await global.page.waitForTimeout(100);
        await global.page.locator('[id^="grid_"]').getByText('Новые технологии ООО').last().dblclick({ timeout: 500 });
        await buttonClick(global.page, 'ФормаПровестиИЗакрыть')
    });
});


// Содержит подстроку
// [id*="ФормаЗаписатьИЗакрыть"]
// Заканчивается на
// [id$="ФормаЗаписатьИЗакрыть"]
// Начинается с
// [id^="ФормаЗаписатьИЗакрыть"]
// Точное совпадение
// [id="form7_ФормаЗаписатьИЗакрыть"]


// ---------- вспомогательные функции ----------

function randomString() {
    return Math.random().toString(36).substring(2, 10);
}

async function closeForm(page) {
    try {
        await page.locator('[id^="VW_page"][id$="headerTopLine_cmd_CloseButton"]').last().click({ timeout: 500 });
    } catch (error) {
        console.warn('⚠️ Кнопка закрытия не найдена или не кликабельна:', error.message);
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

async function buttonClick(page, name) {
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