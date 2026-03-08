import type { Database } from './supabase/types'
import { calculateBudgetSummary } from './budget'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

type Expense = Database['public']['Tables']['expenses']['Row']

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount < 0 ? `-€${abs}` : `€${abs}`
}

export function buildExpenseRows(expenses: Expense[]): { general: Expense[]; transport: Expense[] } {
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date))
  return {
    general: sorted.filter(e => e.category === 'general'),
    transport: sorted.filter(e => e.category === 'transport'),
  }
}

interface ReceiptBuffer {
  path: string
  buffer: Uint8Array
  mimeType: string
}

interface GeneratePdfOptions {
  project: { name: string; total_budget: number }
  client: { name: string } | null
  expenses: Expense[]
  receiptBuffers: ReceiptBuffer[]
  generatedDate?: string
}

export async function generateExpenseReportPdf({
  project,
  client,
  expenses,
  receiptBuffers,
  generatedDate = new Date().toISOString().split('T')[0],
}: GeneratePdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { general, transport } = buildExpenseRows(expenses)
  const summary = calculateBudgetSummary(project.total_budget, expenses)

  // Page dimensions (A4)
  const pageWidth = 595
  const pageHeight = 842
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function drawText(
    text: string,
    x: number,
    yPos: number,
    options: { size?: number; bold?: boolean; color?: [number, number, number] } = {}
  ) {
    const { size = 10, bold = false, color = [0, 0, 0] } = options
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? boldFont : font,
      color: rgb(color[0], color[1], color[2]),
    })
  }

  function checkPageBreak(neededHeight: number) {
    if (y - neededHeight < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // Header
  drawText('EXPENSE REPORT', margin, y, { size: 20, bold: true })
  y -= 28
  drawText(project.name, margin, y, { size: 14, bold: true })
  y -= 18
  if (client) {
    drawText(`Client: ${client.name}`, margin, y, { size: 10 })
    y -= 14
  }
  drawText(`Generated: ${generatedDate}`, margin, y, { size: 9, color: [0.5, 0.5, 0.5] })
  y -= 24

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 16

  // Budget summary section
  drawText('BUDGET SUMMARY', margin, y, { size: 9, bold: true, color: [0.4, 0.4, 0.4] })
  y -= 14

  const summaryItems = [
    { label: 'Total Budget', value: formatCurrency(summary.totalBudget) },
    { label: 'General Expenses', value: formatCurrency(summary.spentGeneral) },
    { label: 'Transport Expenses', value: formatCurrency(summary.spentTransport) },
    { label: 'Total Spent', value: formatCurrency(summary.totalSpent) },
  ]

  for (const item of summaryItems) {
    drawText(item.label, margin, y, { size: 10 })
    drawText(item.value, pageWidth - margin - 60, y, { size: 10 })
    y -= 13
  }

  // Remaining — colored
  drawText('Remaining', margin, y, { size: 10, bold: true })
  drawText(
    formatCurrency(summary.remaining),
    pageWidth - margin - 60,
    y,
    { size: 10, bold: true, color: summary.isOverBudget ? [0.8, 0, 0] : [0, 0.5, 0] }
  )
  y -= 20

  if (summary.isOverBudget) {
    drawText(
      `WARNING: This project is over budget by ${formatCurrency(Math.abs(summary.remaining))}`,
      margin,
      y,
      { size: 9, color: [0.8, 0, 0] }
    )
    y -= 18
  }

  // Expense table helper
  function drawExpenseTable(title: string, rows: Expense[]) {
    if (rows.length === 0) return

    checkPageBreak(40)
    y -= 8
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
    y -= 14

    drawText(title, margin, y, { size: 11, bold: true })
    y -= 16

    // Column headers
    drawText('Date', margin, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
    drawText('Vendor', margin + 65, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
    drawText('Notes', margin + 230, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
    drawText('Amount', pageWidth - margin - 55, y, { size: 8, bold: true, color: [0.4, 0.4, 0.4] })
    y -= 10

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
    })
    y -= 11

    for (const row of rows) {
      checkPageBreak(14)
      const amountStr = row.is_return
        ? `+${formatCurrency(Math.abs(row.amount))}`
        : formatCurrency(row.amount)
      const amountColor: [number, number, number] = row.is_return ? [0, 0.5, 0] : [0, 0, 0]

      drawText(row.date, margin, y, { size: 8 })
      drawText((row.vendor ?? '—').substring(0, 28), margin + 65, y, { size: 8 })
      drawText((row.notes ?? '').substring(0, 22), margin + 230, y, { size: 8 })
      drawText(amountStr, pageWidth - margin - 55, y, { size: 8, color: amountColor })
      y -= 13
    }

    // Section total
    const sectionTotal = rows.reduce(
      (sum, r) => sum + (r.is_return ? -Math.abs(r.amount) : Math.abs(r.amount)),
      0
    )
    page.drawLine({
      start: { x: pageWidth - margin - 80, y: y + 6 },
      end: { x: pageWidth - margin, y: y + 6 },
      thickness: 0.3,
      color: rgb(0, 0, 0),
    })
    drawText('Total', pageWidth - margin - 80, y - 2, { size: 8, bold: true })
    drawText(formatCurrency(sectionTotal), pageWidth - margin - 55, y - 2, { size: 8, bold: true })
    y -= 16
  }

  drawExpenseTable('General Expenses', general)
  drawExpenseTable('Transport Expenses', transport)

  // Append receipt pages
  for (const { buffer, mimeType, path } of receiptBuffers) {
    if (mimeType === 'application/pdf') {
      try {
        const receiptPdf = await PDFDocument.load(buffer)
        const copiedPages = await pdfDoc.copyPages(receiptPdf, receiptPdf.getPageIndices())
        copiedPages.forEach(p => pdfDoc.addPage(p))
      } catch {
        // Skip corrupt PDFs
      }
    } else {
      // Image — embed on a new page
      const receiptPage = pdfDoc.addPage([pageWidth, pageHeight])
      try {
        const img = mimeType === 'image/png'
          ? await pdfDoc.embedPng(buffer)
          : await pdfDoc.embedJpg(buffer)
        const { width, height } = img.scaleToFit(pageWidth - margin * 2, pageHeight - margin * 2)
        receiptPage.drawImage(img, {
          x: (pageWidth - width) / 2,
          y: (pageHeight - height) / 2,
          width,
          height,
        })
        // Add label at bottom
        receiptPage.drawText(`Receipt: ${path.split('/').pop()}`, {
          x: margin,
          y: margin - 15,
          size: 7,
          font,
          color: rgb(0.6, 0.6, 0.6),
        })
      } catch {
        // Skip corrupt images
      }
    }
  }

  return pdfDoc.save()
}
