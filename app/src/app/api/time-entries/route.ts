import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandRecurrence, RecurrenceRule } from "@/lib/recurrence";

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const categoryId = searchParams.get("categoryId");
  const genreId = searchParams.get("genreId");
  const keyword = searchParams.get("keyword");

  const where: Record<string, unknown> = {};
  let rangeStart: string | null = null;
  let rangeEnd: string | null = null;

  if (date) {
    where.date = new Date(date);
    rangeStart = date;
    rangeEnd = date;
  } else if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    rangeStart = startDate;
    rangeEnd = endDate;
  }
  if (categoryId) where.categoryId = categoryId;
  if (genreId) where.genreId = genreId;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { detail: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { category: true, genre: true },
    orderBy: [{ date: "asc" }, { startSlot: "asc" }],
  });

  if (!rangeStart || !rangeEnd) {
    return NextResponse.json(entries);
  }

  // Expand recurring entries into virtual instances
  const sixMonthsLater = formatDate(addMonths(new Date(), 6));
  const effectiveRangeEnd = rangeEnd > sixMonthsLater ? sixMonthsLater : rangeEnd;

  // Find all recurring parents that could generate instances in this range
  const recurringParents = await prisma.timeEntry.findMany({
    where: {
      recurrenceRule: { not: null },
      parentRecurrenceId: null,
      ...(categoryId ? { categoryId } : {}),
      ...(genreId ? { genreId } : {}),
      ...(keyword ? {
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { detail: { contains: keyword, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: { category: true, genre: true, overrides: true },
  });

  // Collect overrides for each parent in our range
  const overridesByParent = new Map<string, Map<string, typeof entries[number]>>();
  for (const parent of recurringParents) {
    const map = new Map<string, typeof entries[number]>();
    // Also fetch overrides
    const overrides = await prisma.timeEntry.findMany({
      where: { parentRecurrenceId: parent.id },
      include: { category: true, genre: true },
    });
    for (const ov of overrides) {
      if (ov.originalDate) {
        map.set(formatDate(ov.originalDate), ov);
      }
    }
    overridesByParent.set(parent.id, map);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const virtualEntries: any[] = [];

  for (const parent of recurringParents) {
    const rule = JSON.parse(parent.recurrenceRule!) as RecurrenceRule;
    const parentDate = formatDate(parent.date);
    const recEnd = parent.recurrenceEnd ? formatDate(parent.recurrenceEnd) : null;

    const dates = expandRecurrence(rule, parentDate, recEnd, rangeStart, effectiveRangeEnd);
    const overrideMap = overridesByParent.get(parent.id) || new Map();

    for (const d of dates) {
      const override = overrideMap.get(d);
      if (override) {
        if (!override.skipped) {
          const inRange = d >= rangeStart && d <= rangeEnd;
          if (inRange && !entries.some((e) => e.id === override.id)) {
            virtualEntries.push(override);
          }
        }
        continue;
      }

      if (d < rangeStart || d > rangeEnd) continue;
      if (d === parentDate) continue;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { overrides: _ov, ...rest } = parent;
      virtualEntries.push({
        ...rest,
        id: `${parent.id}__${d}`,
        date: new Date(d),
        originalDate: new Date(d),
        parentRecurrenceId: parent.id,
        skipped: false,
      });
    }
  }

  const nonRecurringEntries = entries.filter((e) => !e.parentRecurrenceId || !e.skipped);
  const allEntries = [...nonRecurringEntries, ...virtualEntries];
  allEntries.sort((a, b) => {
    const da = formatDate(new Date(a.date));
    const db = formatDate(new Date(b.date));
    if (da !== db) return da.localeCompare(db);
    return a.startSlot - b.startSlot;
  });

  return NextResponse.json(allEntries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const entry = await prisma.timeEntry.create({
    data: {
      date: new Date(body.date),
      startSlot: body.startSlot,
      endSlot: body.endSlot,
      categoryId: body.categoryId,
      genreId: body.genreId,
      title: body.title || null,
      detail: body.detail || null,
      recurrenceRule: body.recurrenceRule || null,
      recurrenceEnd: body.recurrenceEnd ? new Date(body.recurrenceEnd) : null,
      parentRecurrenceId: body.parentRecurrenceId || null,
      originalDate: body.originalDate ? new Date(body.originalDate) : null,
      skipped: body.skipped || false,
    },
    include: { category: true, genre: true },
  });
  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const scope = body.scope as string | undefined; // "single" | "future" | "all"
  const virtualDate = body.virtualDate as string | undefined; // date of the virtual instance being edited

  // Editing a virtual instance (not yet materialized)
  if (body.id && body.id.includes("__") && scope === "single") {
    const [parentId] = body.id.split("__");
    // Create an override entry for this single instance
    const parent = await prisma.timeEntry.findUnique({
      where: { id: parentId },
      include: { category: true, genre: true },
    });
    if (!parent) return NextResponse.json({ error: "parent not found" }, { status: 404 });

    const override = await prisma.timeEntry.create({
      data: {
        date: body.date ? new Date(body.date) : new Date(virtualDate!),
        startSlot: body.startSlot ?? parent.startSlot,
        endSlot: body.endSlot ?? parent.endSlot,
        categoryId: body.categoryId ?? parent.categoryId,
        genreId: body.genreId ?? parent.genreId,
        title: body.title !== undefined ? (body.title || null) : parent.title,
        detail: body.detail !== undefined ? (body.detail || null) : parent.detail,
        parentRecurrenceId: parentId,
        originalDate: new Date(virtualDate!),
      },
      include: { category: true, genre: true },
    });
    return NextResponse.json(override);
  }

  // Editing a real entry or override
  const realId = body.id.includes("__") ? body.id.split("__")[0] : body.id;

  if (scope === "all") {
    // Update the parent (or this entry if it IS the parent)
    const entry = await prisma.timeEntry.findUnique({ where: { id: realId } });
    if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

    const parentId = entry.parentRecurrenceId || entry.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (body.startSlot !== undefined) data.startSlot = body.startSlot;
    if (body.endSlot !== undefined) data.endSlot = body.endSlot;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.genreId !== undefined) data.genreId = body.genreId;
    if (body.title !== undefined) data.title = body.title || null;
    if (body.detail !== undefined) data.detail = body.detail || null;
    if (body.recurrenceRule !== undefined) data.recurrenceRule = body.recurrenceRule || null;
    if (body.recurrenceEnd !== undefined) data.recurrenceEnd = body.recurrenceEnd ? new Date(body.recurrenceEnd) : null;

    const updated = await prisma.timeEntry.update({
      where: { id: parentId },
      data,
      include: { category: true, genre: true },
    });

    // Delete all overrides (they were based on old pattern)
    await prisma.timeEntry.deleteMany({
      where: { parentRecurrenceId: parentId },
    });

    return NextResponse.json(updated);
  }

  if (scope === "future") {
    const entry = await prisma.timeEntry.findUnique({ where: { id: realId } });
    if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

    const parentId = entry.parentRecurrenceId || entry.id;
    const futureDate = virtualDate || (body.date ? body.date : formatDate(entry.date));

    // Set recurrenceEnd on parent to the day before futureDate
    const endDate = new Date(futureDate + "T00:00:00");
    endDate.setDate(endDate.getDate() - 1);

    await prisma.timeEntry.update({
      where: { id: parentId },
      data: { recurrenceEnd: endDate },
    });

    // Delete future overrides
    await prisma.timeEntry.deleteMany({
      where: {
        parentRecurrenceId: parentId,
        originalDate: { gte: new Date(futureDate) },
      },
    });

    // Create a new recurring parent from this date with the new data
    const parent = await prisma.timeEntry.findUnique({
      where: { id: parentId },
      include: { category: true, genre: true },
    });
    if (!parent) return NextResponse.json({ error: "parent not found" }, { status: 404 });

    const newParent = await prisma.timeEntry.create({
      data: {
        date: new Date(futureDate),
        startSlot: body.startSlot ?? parent.startSlot,
        endSlot: body.endSlot ?? parent.endSlot,
        categoryId: body.categoryId ?? parent.categoryId,
        genreId: body.genreId ?? parent.genreId,
        title: body.title !== undefined ? (body.title || null) : parent.title,
        detail: body.detail !== undefined ? (body.detail || null) : parent.detail,
        recurrenceRule: body.recurrenceRule !== undefined ? (body.recurrenceRule || null) : parent.recurrenceRule,
        recurrenceEnd: body.recurrenceEnd !== undefined
          ? (body.recurrenceEnd ? new Date(body.recurrenceEnd) : null)
          : parent.recurrenceEnd,
      },
      include: { category: true, genre: true },
    });

    return NextResponse.json(newParent);
  }

  // scope === "single" or no scope (non-recurring edit)
  // If it's an override entry, just update it
  // If it's a parent with recurrence, create an override
  const entry = await prisma.timeEntry.findUnique({ where: { id: realId } });
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (entry.recurrenceRule && !entry.parentRecurrenceId && scope === "single") {
    // This is a parent being edited for a specific date — create override
    const override = await prisma.timeEntry.create({
      data: {
        date: body.date ? new Date(body.date) : entry.date,
        startSlot: body.startSlot ?? entry.startSlot,
        endSlot: body.endSlot ?? entry.endSlot,
        categoryId: body.categoryId ?? entry.categoryId,
        genreId: body.genreId ?? entry.genreId,
        title: body.title !== undefined ? (body.title || null) : entry.title,
        detail: body.detail !== undefined ? (body.detail || null) : entry.detail,
        parentRecurrenceId: entry.id,
        originalDate: virtualDate ? new Date(virtualDate) : entry.date,
      },
      include: { category: true, genre: true },
    });
    return NextResponse.json(override);
  }

  // Regular update (no recurrence scope)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    startSlot: body.startSlot,
    endSlot: body.endSlot,
    categoryId: body.categoryId,
    genreId: body.genreId,
    title: body.title || null,
    detail: body.detail || null,
  };
  if (body.date !== undefined) {
    data.date = new Date(body.date);
  }
  if (body.recurrenceRule !== undefined) {
    data.recurrenceRule = body.recurrenceRule || null;
  }
  if (body.recurrenceEnd !== undefined) {
    data.recurrenceEnd = body.recurrenceEnd ? new Date(body.recurrenceEnd) : null;
  }

  const updated = await prisma.timeEntry.update({
    where: { id: realId },
    data,
    include: { category: true, genre: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const scope = searchParams.get("scope"); // "single" | "future" | "all"
  const virtualDate = searchParams.get("virtualDate");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Virtual instance deletion (not yet materialized)
  if (id.includes("__") && scope === "single") {
    const [parentId] = id.split("__");
    // Create a skipped override
    const parent = await prisma.timeEntry.findUnique({ where: { id: parentId } });
    if (!parent) return NextResponse.json({ error: "parent not found" }, { status: 404 });

    await prisma.timeEntry.create({
      data: {
        date: new Date(virtualDate!),
        startSlot: parent.startSlot,
        endSlot: parent.endSlot,
        categoryId: parent.categoryId,
        genreId: parent.genreId,
        title: parent.title,
        detail: parent.detail,
        parentRecurrenceId: parentId,
        originalDate: new Date(virtualDate!),
        skipped: true,
      },
    });
    return NextResponse.json({ success: true });
  }

  const realId = id.includes("__") ? id.split("__")[0] : id;
  const entry = await prisma.timeEntry.findUnique({ where: { id: realId } });
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (scope === "all") {
    const parentId = entry.parentRecurrenceId || entry.id;
    // Delete all overrides then the parent
    await prisma.timeEntry.deleteMany({ where: { parentRecurrenceId: parentId } });
    await prisma.timeEntry.delete({ where: { id: parentId } });
    return NextResponse.json({ success: true });
  }

  if (scope === "future") {
    const parentId = entry.parentRecurrenceId || entry.id;
    const futureDate = virtualDate || formatDate(entry.date);

    // Set recurrenceEnd on parent to the day before
    const endDate = new Date(futureDate + "T00:00:00");
    endDate.setDate(endDate.getDate() - 1);

    // If endDate is before the parent's own date, just delete everything
    const parent = await prisma.timeEntry.findUnique({ where: { id: parentId } });
    if (parent && endDate < parent.date) {
      await prisma.timeEntry.deleteMany({ where: { parentRecurrenceId: parentId } });
      await prisma.timeEntry.delete({ where: { id: parentId } });
    } else {
      await prisma.timeEntry.update({
        where: { id: parentId },
        data: { recurrenceEnd: endDate },
      });
      // Delete future overrides
      await prisma.timeEntry.deleteMany({
        where: {
          parentRecurrenceId: parentId,
          originalDate: { gte: new Date(futureDate) },
        },
      });
    }
    return NextResponse.json({ success: true });
  }

  // scope === "single" or no scope
  if (entry.parentRecurrenceId && !entry.skipped) {
    // This is an override — mark it as skipped instead of deleting
    await prisma.timeEntry.update({
      where: { id: realId },
      data: { skipped: true },
    });
    return NextResponse.json({ success: true });
  }

  if (entry.recurrenceRule && !entry.parentRecurrenceId && scope === "single") {
    // Parent entry — skip this single date
    await prisma.timeEntry.create({
      data: {
        date: entry.date,
        startSlot: entry.startSlot,
        endSlot: entry.endSlot,
        categoryId: entry.categoryId,
        genreId: entry.genreId,
        parentRecurrenceId: entry.id,
        originalDate: virtualDate ? new Date(virtualDate) : entry.date,
        skipped: true,
      },
    });
    return NextResponse.json({ success: true });
  }

  // Non-recurring entry or delete of override
  if (entry.parentRecurrenceId) {
    await prisma.timeEntry.delete({ where: { id: realId } });
  } else {
    // Delete overrides first, then parent
    await prisma.timeEntry.deleteMany({ where: { parentRecurrenceId: realId } });
    await prisma.timeEntry.delete({ where: { id: realId } });
  }
  return NextResponse.json({ success: true });
}
