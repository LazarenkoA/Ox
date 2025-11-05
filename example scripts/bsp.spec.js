import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
    await page.goto('http://localhost/bsp/ru_RU/');
    await page.locator('#userName').click();
    await page.locator('#userName').fill('Администратор');
    await page.locator('#userName').press('Tab');
    await page.locator('#userPassword').fill('123');
    await page.locator('#userPassword').press('Enter');

    await page.locator('#themesCell_theme_3').getByText('Сервисные подсистемы').click();
    await page.locator('#cmd_0_6_txt').click();
    await page.locator('div:nth-child(4) > div:nth-child(2) > .gridBoxTitle').click();
    await page.getByText('АОЗТ Лабан').dblclick();
    await page.locator('[id="form5_ФормаЗаписатьИЗакрыть"]').click();
    await page.locator('[id="form4_ФормаСоздать"]').click();
    await page.getByRole('textbox', { name: 'Наименование:' }).click();

    const name = randomString();
    await page.getByRole('textbox', { name: 'Наименование:' }).pressSequentially(name);
    await page.getByRole('textbox', { name: 'Наименование полное:' }).click();
    await page.getByRole('textbox', { name: 'Наименование полное:' }).pressSequentially(randomString());
    await page.locator('[id="form6_Родитель_DLB"]').click();
    await page.getByText('Показать все').first().click();
    await page.locator('div:nth-child(2) > .gridBox.gridBoxTree > .gridBoxImg > div:nth-child(2)').click();
    await page.getByText('Демо: КонтрагентыБез партнера').click();
    await page.locator('[id="grid_form7_Список"]').getByText('Без партнера').click();
    await page.locator('[id="form7_ФормаВыбрать"]').click();
    await page.locator('a[id $= "ФормаЗаписатьИЗакрыть"]').click();
    // Содержит подстроку
    // [id*="ФормаЗаписатьИЗакрыть"]
    // Заканчивается на
    // [id$="ФормаЗаписатьИЗакрыть"]
    // Начинается с
    // [id^="ФормаЗаписатьИЗакрыть"]
    // Точное совпадение
    // [id="form7_ФормаЗаписатьИЗакрыть"]

    await page.locator('[id="grid_form4_Список"]').getByText(name).click({ button: 'right' });
    await page.locator('#popupItem4').getByText('Пометить на удаление / Снять пометку').click();
    await page.locator('[id^="form"][id$="_Button0"] a').filter({ hasText: 'Да' }).click();
    await page.locator('#themesCell_theme_5').getByText('Интегрируемые').click();
    await page.locator('#cmd_0_6_txt').click();

    // клик по строке в списке
    page.locator('div.gridLine').last().dblclick();

    await page.locator('a[id^="form"][id$="_ФормаПровестиИЗакрыть"]').click();
    await page.locator('a[id^="form"][id$="_ФормаСоздать"]').last().click();
    await page.locator('[id^="form"][id$="_Организация_DLB"]').click();
    await page.getByText('Показать все').first().click();
    await page.locator('[id^="grid_form"][id$="_Список"]').last().getByText('Перспектива ЗАО').dblclick();
    await page.getByRole('textbox', { name: 'Сумма документа: Выбрать (F4)' }).click();
    await page.getByRole('textbox', { name: 'Сумма документа: Выбрать (F4)' }).pressSequentially("1");
    await page.locator('[id^="form"][id$="_Партнер_DLB"]').click();
    await page.getByText('Показать все').first().click();
    await page.locator('[id^="grid_form"][id$="_Список"]').last().getByText('ООО "Альфа"').dblclick();

    const elems = await page.locator('[id$="_ФормаПровестиИЗакрыть"]').elementHandles();
    for (const btn of elems) {
        const id = await btn.evaluate(el => el.id);
        if (/^form\d+_ФормаПровестиИЗакрыть$/.test(id)) {
            await btn.click();
            break; // кликнули первый подходящий
        }
    }

});

function randomString() {
    return Math.random().toString(36).substring(2, 10);
}