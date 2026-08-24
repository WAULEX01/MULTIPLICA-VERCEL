import { generateUUID } from '../services/db';
import type { ChurchEvent } from '../services/db';

export function parseICSText(text: string, existingEvents: ChurchEvent[], sessionPersonId: string): { importedEvents: ChurchEvent[], eventsParsed: number, eventsIgnoredDuplicates: number } {
  // Remove quebras de linha do padrão ICS (Unfold)
  const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfoldedText.split(/\r?\n|\r/);
  
  let inEvent = false;
  let currentEvent: any = {};
  const importedEvents: ChurchEvent[] = [];
  let eventsParsed = 0;
  let eventsIgnoredDuplicates = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line.toUpperCase() === 'END:VEVENT') {
      inEvent = false;
      eventsParsed++;
      if (currentEvent.title && currentEvent.date) {
        
        const addEvent = (title: string, dateStr: string, desc: string, endDateStr?: string) => {
          const isDuplicate = existingEvents.some(ev => !ev.deleted && ev.title === title && ev.date === dateStr) || 
                              importedEvents.some(ev => ev.title === title && ev.date === dateStr);
          if (!isDuplicate) {
            importedEvents.push({
              id: 'ev_' + generateUUID() + Math.random().toString(36).substring(2, 9),
              title: title,
              date: dateStr,
              endDate: endDateStr,
              description: desc,
              createdBy: sessionPersonId || 'admin',
              updatedAt: new Date().toISOString(),
              version: 1
            });
          } else {
            eventsIgnoredDuplicates++;
          }
        };

        addEvent(currentEvent.title, currentEvent.date, currentEvent.description || '', currentEvent.endDate);

        if (currentEvent.rrule) {
          const rruleUpper = currentEvent.rrule.toUpperCase();
          const isWeekly = rruleUpper.includes('FREQ=WEEKLY');
          const isMonthly = rruleUpper.includes('FREQ=MONTHLY');
          const isDaily = rruleUpper.includes('FREQ=DAILY');
          
          if (isWeekly || isMonthly || isDaily) {
            const limit = isDaily ? 30 : (isWeekly ? 52 : 12);
            let currentDateObj = new Date(currentEvent.date + 'T12:00:00');
            
            for (let j = 1; j <= limit; j++) {
              if (isDaily) currentDateObj.setDate(currentDateObj.getDate() + 1);
              else if (isWeekly) currentDateObj.setDate(currentDateObj.getDate() + 7);
              else if (isMonthly) currentDateObj.setMonth(currentDateObj.getMonth() + 1);
              
              const newDateStr = currentDateObj.toISOString().split('T')[0];
              addEvent(currentEvent.title, newDateStr, currentEvent.description || '');
            }
          }
        }
      }
    } else if (inEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const keyPart = line.substring(0, colonIdx).toUpperCase();
        const valuePart = line.substring(colonIdx + 1).trim();

        if (keyPart.startsWith('SUMMARY')) {
          currentEvent.title = valuePart;
        } else if (keyPart.startsWith('DTSTART')) {
          const match = valuePart.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
          if (match) {
            currentEvent.date = `${match[1]}-${match[2]}-${match[3]}`;
          }
        } else if (keyPart.startsWith('DTEND')) {
          const match = valuePart.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
          if (match) {
            // ICS DTEND is exclusive (end is the day AFTER). Subtract 1 day for display.
            const d = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
            d.setDate(d.getDate() - 1);
            const endStr = d.toISOString().split('T')[0];
            // Only save if endDate is after startDate
            if (!currentEvent.date || endStr > currentEvent.date) {
              currentEvent.endDate = endStr;
            }
          }
        } else if (keyPart.startsWith('DESCRIPTION')) {
          currentEvent.description = valuePart;
        } else if (keyPart.startsWith('RRULE')) {
          currentEvent.rrule = valuePart;
        }
      }
    }
  }

  return { importedEvents, eventsParsed, eventsIgnoredDuplicates };
}
