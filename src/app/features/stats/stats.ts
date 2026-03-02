import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { EntriesService } from '@core/services/entries';
import { AiService } from '@core/services/ai';
import { Entry } from '@core/models/entry';
import type { WeeklySummaryResponse } from '@core/models/ai';
import { LoadingComponent } from '@shared/components/loading/loading';

@Component({
  selector: 'app-stats',
  standalone: true,
  providers: [provideCharts(withDefaultRegisterables())],
  imports: [
    MatButton,
    MatIcon,
    MatCard,
    MatCardContent,
    MatCardHeader,
    MatCardTitle,
    BaseChartDirective,
    LoadingComponent,
  ],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class StatsComponent implements OnInit {
  loading = true;
  streak = 0;
  entryCount = 0;
  averageMood: number | null = null;
  topTags: Array<{ tag: string; count: number }> = [];
  summarizing = false;
  summaryResult: WeeklySummaryResponse | null = null;

  chartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Words' }],
  };

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true },
    },
    plugins: {
      legend: { display: false },
    },
  };

  private readonly todayDate: string = this.getLocalDateString();

  constructor(
    private entriesService: EntriesService,
    private aiService: AiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  async onWeeklySummary(): Promise<void> {
    this.summarizing = true;
    this.summaryResult = null;
    try {
      const startDate = this.subtractDays(this.todayDate, 6); // last 7 days
      const entries = await this.entriesService.getEntriesInRange(startDate, this.todayDate);
      if (entries.length === 0) {
        this.snackBar.open('No entries in the last 7 days to summarize.', 'Dismiss', { duration: 4000 });
        return;
      }
      this.summaryResult = await this.aiService.weeklySummary(entries);
    } catch {
      this.snackBar.open('Could not generate summary. Please try again.', 'Dismiss', { duration: 4000 });
    } finally {
      this.summarizing = false;
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const startDate = this.subtractDays(this.todayDate, 13); // 14 days including today
      const entries = await this.entriesService.getEntriesInRange(startDate, this.todayDate);
      this.entryCount = entries.length;
      this.streak = this.computeStreak(entries);
      this.averageMood = this.computeAverageMood(entries);
      this.topTags = this.computeTopTags(entries);
      this.chartData = this.buildChartData(entries);
    } catch {
      this.snackBar.open('Could not load stats.', 'Dismiss', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }

  private computeStreak(entries: Entry[]): number {
    const dates = new Set(entries.map(e => e.entry_date));
    // If today has no entry yet, start counting from yesterday (don't break streak)
    const startOffset = dates.has(this.todayDate) ? 0 : 1;
    let streak = 0;
    for (let i = startOffset; i < 14; i++) {
      if (dates.has(this.subtractDays(this.todayDate, i))) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private computeAverageMood(entries: Entry[]): number | null {
    const withMood = entries.filter(e => e.mood != null);
    if (withMood.length === 0) return null;
    const avg = withMood.reduce((sum, e) => sum + (e.mood ?? 0), 0) / withMood.length;
    return Math.round(avg * 10) / 10;
  }

  private computeTopTags(entries: Entry[]): Array<{ tag: string; count: number }> {
    const freq = new Map<string, number>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private buildChartData(entries: Entry[]): ChartData<'bar'> {
    const wcByDate = new Map<string, number>();
    for (const entry of entries) {
      wcByDate.set(entry.entry_date, this.wordCount(entry.body));
    }

    const labels: string[] = [];
    const data: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = this.subtractDays(this.todayDate, i);
      const [y, m, d] = date.split('-').map(Number);
      labels.push(
        new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      );
      data.push(wcByDate.get(date) ?? 0);
    }

    return { labels, datasets: [{ data, label: 'Words' }] };
  }

  private wordCount(body: string): number {
    return body.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private subtractDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - days);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private getLocalDateString(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
