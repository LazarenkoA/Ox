import { test, expect } from '@playwright/test';

test('Тест свод отчетов', async ({ page }) => {
    test.setTimeout(100_000); // секунд только для этого теста

    await page.goto('https://localhost/sko/ru/');
    await page.locator('#userName').click();
    await page.locator('#userName').fill('Администратор');
    await page.locator('.authPassInput').first().click();
    await page.locator('#userPassword').click();
    await page.locator('#userPassword').fill('Hi');
    await page.getByRole('button', { name: 'Войти' }).click();

    await page.getByText('Ф. 0503737').nth(2).dblclick();
    await close(page);

    await page.waitForTimeout(100);
    await page.getByText('Нормативно-справочная').click();
    await page.waitForTimeout(100);

    await page.getByText('Бюджеты').click();
    await page.waitForTimeout(100);

    await doubleClickRandomRow(page);
    await closeButton(page, 'ФормаЗаписатьИЗакрыть')

    const count = await page.locator('id$="_CommandButtonOK"');
    if(count > 0) {
        await page.locator('id$="_CommandButtonOK"').click();
        await closeButton(page, 'ФормаЗаписатьИЗакрыть')
    }

    await page.waitForTimeout(500);
    await page.getByText('Анализ данных').click();
    await page.waitForTimeout(500); // пауза
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

function randomString() {
    return Math.random().toString(36).substring(2, 10);
}

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
