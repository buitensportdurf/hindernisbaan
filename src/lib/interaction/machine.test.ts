import { describe, expect, it } from 'vitest';
import {
  transition,
  type InteractionConfig,
  type InteractionState
} from './machine';

const mapMode: InteractionConfig = { openDetailsOn: 'click' };
const designMode: InteractionConfig = { openDetailsOn: 'dblclick' };

const idle: InteractionState = { kind: 'idle' };
const selected = (id: string): InteractionState => ({ kind: 'selected', id });
const details = (id: string): InteractionState => ({ kind: 'details', id });
const drawing = (tool: 'point' | 'landmark' | 'line' | 'polygon' | 'rectangle' | 'remove'): InteractionState => ({
  kind: 'drawing',
  tool
});

describe('featureClick', () => {
  describe('openDetailsOn: click (map mode)', () => {
    it('idle → details', () => {
      expect(transition(idle, { type: 'featureClick', id: 'a' }, mapMode)).toEqual(details('a'));
    });

    it('selected → details (new id)', () => {
      expect(transition(selected('a'), { type: 'featureClick', id: 'b' }, mapMode)).toEqual(
        details('b')
      );
    });

    it('details unchanged', () => {
      expect(transition(details('a'), { type: 'featureClick', id: 'b' }, mapMode)).toEqual(
        details('a')
      );
    });

    it('drawing unchanged', () => {
      expect(transition(drawing('point'), { type: 'featureClick', id: 'a' }, mapMode)).toEqual(
        drawing('point')
      );
    });
  });

  describe('openDetailsOn: dblclick (design mode)', () => {
    it('idle → selected', () => {
      expect(transition(idle, { type: 'featureClick', id: 'a' }, designMode)).toEqual(
        selected('a')
      );
    });

    it('selected → selected (new id)', () => {
      expect(transition(selected('a'), { type: 'featureClick', id: 'b' }, designMode)).toEqual(
        selected('b')
      );
    });

    it('details unchanged', () => {
      expect(transition(details('a'), { type: 'featureClick', id: 'b' }, designMode)).toEqual(
        details('a')
      );
    });

    it('drawing unchanged', () => {
      expect(transition(drawing('line'), { type: 'featureClick', id: 'a' }, designMode)).toEqual(
        drawing('line')
      );
    });
  });
});

describe('featureDoubleClick', () => {
  describe('openDetailsOn: dblclick (design mode)', () => {
    it('idle → details', () => {
      expect(transition(idle, { type: 'featureDoubleClick', id: 'a' }, designMode)).toEqual(
        details('a')
      );
    });

    it('selected → details', () => {
      expect(
        transition(selected('a'), { type: 'featureDoubleClick', id: 'b' }, designMode)
      ).toEqual(details('b'));
    });

    it('details unchanged', () => {
      expect(
        transition(details('a'), { type: 'featureDoubleClick', id: 'b' }, designMode)
      ).toEqual(details('a'));
    });

    it('drawing unchanged', () => {
      expect(
        transition(drawing('polygon'), { type: 'featureDoubleClick', id: 'a' }, designMode)
      ).toEqual(drawing('polygon'));
    });
  });

  describe('openDetailsOn: click (map mode)', () => {
    it('idle unchanged', () => {
      expect(transition(idle, { type: 'featureDoubleClick', id: 'a' }, mapMode)).toEqual(idle);
    });

    it('selected unchanged', () => {
      expect(
        transition(selected('a'), { type: 'featureDoubleClick', id: 'b' }, mapMode)
      ).toEqual(selected('a'));
    });

    it('details unchanged', () => {
      expect(
        transition(details('a'), { type: 'featureDoubleClick', id: 'b' }, mapMode)
      ).toEqual(details('a'));
    });

    it('drawing unchanged', () => {
      expect(
        transition(drawing('rectangle'), { type: 'featureDoubleClick', id: 'a' }, mapMode)
      ).toEqual(drawing('rectangle'));
    });
  });
});

describe('backgroundClick', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] selected → idle`, () => {
      expect(transition(selected('a'), { type: 'backgroundClick' }, config)).toEqual(idle);
    });

    it(`[${label}] idle unchanged`, () => {
      expect(transition(idle, { type: 'backgroundClick' }, config)).toEqual(idle);
    });

    it(`[${label}] details unchanged`, () => {
      expect(transition(details('a'), { type: 'backgroundClick' }, config)).toEqual(details('a'));
    });

    it(`[${label}] drawing unchanged`, () => {
      expect(transition(drawing('point'), { type: 'backgroundClick' }, config)).toEqual(
        drawing('point')
      );
    });
  }
});

describe('escape', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] selected → idle`, () => {
      expect(transition(selected('a'), { type: 'escape' }, config)).toEqual(idle);
    });

    it(`[${label}] drawing → idle`, () => {
      expect(transition(drawing('remove'), { type: 'escape' }, config)).toEqual(idle);
    });

    it(`[${label}] details unchanged`, () => {
      expect(transition(details('a'), { type: 'escape' }, config)).toEqual(details('a'));
    });

    it(`[${label}] idle unchanged`, () => {
      expect(transition(idle, { type: 'escape' }, config)).toEqual(idle);
    });
  }
});

describe('closeDetails', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] details → ${config.openDetailsOn === 'click' ? 'idle' : 'selected'}`, () => {
      expect(transition(details('a'), { type: 'closeDetails' }, config)).toEqual(
        config.openDetailsOn === 'click' ? idle : selected('a')
      );
    });

    it(`[${label}] idle unchanged`, () => {
      expect(transition(idle, { type: 'closeDetails' }, config)).toEqual(idle);
    });

    it(`[${label}] selected unchanged`, () => {
      expect(transition(selected('a'), { type: 'closeDetails' }, config)).toEqual(selected('a'));
    });

    it(`[${label}] drawing unchanged`, () => {
      expect(transition(drawing('landmark'), { type: 'closeDetails' }, config)).toEqual(
        drawing('landmark')
      );
    });
  }
});

describe('setTool', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] setTool(null) drawing → idle`, () => {
      expect(transition(drawing('point'), { type: 'setTool', tool: null }, config)).toEqual(idle);
    });

    it(`[${label}] setTool(null) idle unchanged`, () => {
      expect(transition(idle, { type: 'setTool', tool: null }, config)).toEqual(idle);
    });

    it(`[${label}] setTool(null) selected unchanged`, () => {
      expect(transition(selected('a'), { type: 'setTool', tool: null }, config)).toEqual(
        selected('a')
      );
    });

    it(`[${label}] setTool(null) details unchanged`, () => {
      expect(transition(details('a'), { type: 'setTool', tool: null }, config)).toEqual(
        details('a')
      );
    });

    it(`[${label}] setTool(non-null) from idle → drawing`, () => {
      expect(transition(idle, { type: 'setTool', tool: 'line' }, config)).toEqual(drawing('line'));
    });

    it(`[${label}] setTool(non-null) from selected → drawing`, () => {
      expect(transition(selected('a'), { type: 'setTool', tool: 'polygon' }, config)).toEqual(
        drawing('polygon')
      );
    });

    it(`[${label}] setTool(non-null) from details → drawing`, () => {
      expect(transition(details('a'), { type: 'setTool', tool: 'rectangle' }, config)).toEqual(
        drawing('rectangle')
      );
    });

    it(`[${label}] setTool(non-null) from drawing switches tool`, () => {
      expect(transition(drawing('point'), { type: 'setTool', tool: 'landmark' }, config)).toEqual(
        drawing('landmark')
      );
    });
  }
});

describe('created', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] drawing + valid → details`, () => {
      expect(
        transition(drawing('point'), { type: 'created', id: 'new', valid: true }, config)
      ).toEqual(details('new'));
    });

    it(`[${label}] drawing + invalid → details`, () => {
      expect(
        transition(drawing('line'), { type: 'created', id: 'new', valid: false }, config)
      ).toEqual(details('new'));
    });

    it(`[${label}] idle unchanged`, () => {
      expect(
        transition(idle, { type: 'created', id: 'new', valid: true }, config)
      ).toEqual(idle);
    });

    it(`[${label}] selected unchanged`, () => {
      expect(
        transition(selected('a'), { type: 'created', id: 'new', valid: true }, config)
      ).toEqual(selected('a'));
    });

    it(`[${label}] details unchanged`, () => {
      expect(
        transition(details('a'), { type: 'created', id: 'new', valid: false }, config)
      ).toEqual(details('a'));
    });
  }
});

describe('deleted', () => {
  for (const config of [mapMode, designMode]) {
    const label = config.openDetailsOn;

    it(`[${label}] selected matching id → idle`, () => {
      expect(transition(selected('a'), { type: 'deleted', id: 'a' }, config)).toEqual(idle);
    });

    it(`[${label}] selected non-matching id unchanged`, () => {
      expect(transition(selected('a'), { type: 'deleted', id: 'b' }, config)).toEqual(selected('a'));
    });

    it(`[${label}] details matching id → idle`, () => {
      expect(transition(details('a'), { type: 'deleted', id: 'a' }, config)).toEqual(idle);
    });

    it(`[${label}] details non-matching id unchanged`, () => {
      expect(transition(details('a'), { type: 'deleted', id: 'b' }, config)).toEqual(details('a'));
    });

    it(`[${label}] drawing unchanged (even matching id)`, () => {
      expect(transition(drawing('remove'), { type: 'deleted', id: 'a' }, config)).toEqual(
        drawing('remove')
      );
    });

    it(`[${label}] idle unchanged`, () => {
      expect(transition(idle, { type: 'deleted', id: 'a' }, config)).toEqual(idle);
    });
  }
});
