import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BottleType, Prisma } from '@prisma/client';
import { BottlesService } from './bottles.service';
import { PrismaService } from '../prisma/prisma.service';
import { lookUpProduct, type LookedUpProduct } from './product-lookup';

// The lookup reaches Open Food Facts over the network; stub it so the suite
// stays hermetic and the fallback ordering can be asserted directly. The rest
// of the module (barcode normalisation) is kept real.
jest.mock('./product-lookup', () => {
  const actual =
    jest.requireActual<typeof import('./product-lookup')>('./product-lookup');
  return { ...actual, lookUpProduct: jest.fn() };
});

const lookUpProductMock = lookUpProduct as jest.MockedFunction<
  typeof lookUpProduct
>;

/** The `data` payload of the first call to a mocked Prisma write. */
function firstCallData(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls as unknown as [
    { data: Record<string, unknown> },
  ][];
  return calls[0][0].data;
}

describe('BottlesService', () => {
  let service: BottlesService;
  let prisma: { bottle: Record<string, jest.Mock> };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      bottle: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [BottlesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BottlesService);
  });

  it('throws a ConflictException when deleting a bottle referenced in stock adjustments', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
    });
    prisma.bottle.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
        },
      ),
    );

    await expect(service.remove('bottle-1')).rejects.toThrow(ConflictException);
  });

  it('excludes VIP bottles from the query when includeVip is false', async () => {
    await service.findAll('bar-1', false);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1', vip: false },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });

  it('does not filter by vip when includeVip is true', async () => {
    await service.findAll('bar-1', true);

    expect(prisma.bottle.findMany).toHaveBeenCalledWith({
      where: { barId: 'bar-1' },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
  });

  describe('lookupBarcode', () => {
    it('returns the bottle already in stock, searching on the normalised code', async () => {
      const bottle = {
        id: 'bottle-1',
        name: "Gin Hendrick's",
        barcode: '3049197000470',
      };
      prisma.bottle.findFirst.mockResolvedValue(bottle);

      const result = await service.lookupBarcode(
        'bar-1',
        '3 049 197 000 470',
        true,
      );

      expect(prisma.bottle.findFirst).toHaveBeenCalledWith({
        where: { barId: 'bar-1', barcode: '3049197000470' },
        include: { volumes: true },
      });
      expect(result).toEqual({
        status: 'existing',
        barcode: '3049197000470',
        bottle,
      });
      expect(lookUpProductMock).not.toHaveBeenCalled();
    });

    it('hides VIP bottles from a member who cannot see the VIP shelf', async () => {
      prisma.bottle.findFirst.mockResolvedValue(null);
      lookUpProductMock.mockResolvedValue(null);

      await service.lookupBarcode('bar-1', '3049197000470', false);

      expect(prisma.bottle.findFirst).toHaveBeenCalledWith({
        where: { barId: 'bar-1', barcode: '3049197000470', vip: false },
        include: { volumes: true },
      });
    });

    it('falls back to the product database when the bar has no match', async () => {
      prisma.bottle.findFirst.mockResolvedValue(null);
      const product: LookedUpProduct = {
        name: "Gin Hendrick's",
        type: BottleType.gin,
        imageUrl: null,
        size: '70cl',
      };
      lookUpProductMock.mockResolvedValue(product);

      const result = await service.lookupBarcode(
        'bar-1',
        '3049197000470',
        true,
      );

      expect(lookUpProductMock).toHaveBeenCalledWith('3049197000470');
      expect(result).toEqual({
        status: 'product',
        barcode: '3049197000470',
        product,
      });
    });

    it('reports an unknown code when neither the bar nor the database knows it', async () => {
      prisma.bottle.findFirst.mockResolvedValue(null);
      lookUpProductMock.mockResolvedValue(null);

      const result = await service.lookupBarcode(
        'bar-1',
        '3049197000470',
        true,
      );

      expect(result).toEqual({ status: 'unknown', barcode: '3049197000470' });
    });

    it('rejects a code that is not a plausible barcode before touching the network', async () => {
      await expect(service.lookupBarcode('bar-1', '123', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.bottle.findFirst).not.toHaveBeenCalled();
      expect(lookUpProductMock).not.toHaveBeenCalled();
    });
  });

  describe('barcode persistence', () => {
    it('stores digits only, so a later scan from another device still matches', async () => {
      await service.create({
        barId: 'bar-1',
        name: "Gin Hendrick's",
        type: 'gin',
        quantity: 1,
        tags: [],
        vip: false,
        barcode: '3 049 197 000 470',
      } as unknown as Parameters<BottlesService['create']>[0]);

      expect(firstCallData(prisma.bottle.create).barcode).toBe('3049197000470');
    });

    it('drops an unusable code rather than saving one that can never match', async () => {
      await service.create({
        barId: 'bar-1',
        name: 'Sans code',
        type: 'autre',
        quantity: 1,
        tags: [],
        vip: false,
        barcode: '42',
      } as unknown as Parameters<BottlesService['create']>[0]);

      expect(firstCallData(prisma.bottle.create).barcode).toBeNull();
    });

    it('turns a duplicate barcode into a conflict instead of a 500', async () => {
      prisma.bottle.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['barId', 'barcode'] },
        }),
      );

      await expect(
        service.create({
          barId: 'bar-1',
          name: 'Doublon',
          type: 'gin',
          quantity: 1,
          tags: [],
          vip: false,
          barcode: '3049197000470',
        } as unknown as Parameters<BottlesService['create']>[0]),
      ).rejects.toThrow(ConflictException);
    });

    it('leaves the stored code untouched when the patch omits it', async () => {
      prisma.bottle.findUnique.mockResolvedValue({
        id: 'bottle-1',
        imageUrl: null,
      });
      prisma.bottle.update.mockResolvedValue({ id: 'bottle-1' });

      await service.update('bottle-1', { name: 'Nouveau nom' });

      expect(firstCallData(prisma.bottle.update)).not.toHaveProperty('barcode');
    });
  });
});
