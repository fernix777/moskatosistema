// Sistema de fidelización de clientes

class LoyaltySystem {
    constructor() {
        this.customers = [
            {
                id: 1,
                name: 'Cliente Ejemplo',
                phone: '1234567890',
                email: 'cliente@ejemplo.com',
                points: 100,
                level: 'Plata',
                totalPurchases: 1000
            }
        ];

        this.levels = [
            { name: 'Bronce', minPoints: 0, discount: 0 },
            { name: 'Plata', minPoints: 100, discount: 5 },
            { name: 'Oro', minPoints: 500, discount: 10 },
            { name: 'Platino', minPoints: 1000, discount: 15 }
        ];

        this.rewards = [
            {
                id: 1,
                name: 'Bebida Gratis',
                pointsCost: 50,
                description: 'Cualquier bebida hasta $30'
            },
            {
                id: 2,
                name: 'Descuento Especial',
                pointsCost: 100,
                description: '20% de descuento en tu próxima compra'
            }
        ];
    }

    // Registrar nuevo cliente
    registerCustomer(customerData) {
        const newCustomer = {
            id: this.customers.length + 1,
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email,
            points: 0,
            level: 'Bronce',
            totalPurchases: 0
        };

        this.customers.push(newCustomer);
        return newCustomer;
    }

    // Buscar cliente por teléfono o email
    findCustomer(search) {
        return this.customers.find(customer => 
            customer.phone === search || customer.email === search
        );
    }

    // Calcular puntos por compra
    calculatePoints(amount) {
        // 1 punto por cada $10 de compra
        return Math.floor(amount / 10);
    }

    // Actualizar puntos del cliente
    updatePoints(customerId, amount) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return null;

        const pointsEarned = this.calculatePoints(amount);
        customer.points += pointsEarned;
        customer.totalPurchases += amount;

        // Actualizar nivel del cliente
        this.updateCustomerLevel(customer);

        return {
            customer,
            pointsEarned
        };
    }

    // Actualizar nivel del cliente
    updateCustomerLevel(customer) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (customer.points >= this.levels[i].minPoints) {
                customer.level = this.levels[i].name;
                break;
            }
        }
    }

    // Obtener descuento por nivel
    getLevelDiscount(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return 0;

        const level = this.levels.find(l => l.name === customer.level);
        return level ? level.discount : 0;
    }

    // Canjear puntos por recompensa
    redeemReward(customerId, rewardId) {
        const customer = this.customers.find(c => c.id === customerId);
        const reward = this.rewards.find(r => r.id === rewardId);

        if (!customer || !reward) return null;
        if (customer.points < reward.pointsCost) return false;

        customer.points -= reward.pointsCost;
        return {
            customer,
            reward
        };
    }

    // Obtener recompensas disponibles para un cliente
    getAvailableRewards(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return [];

        return this.rewards.filter(reward => customer.points >= reward.pointsCost);
    }
}

// Exportar el sistema de fidelización
const loyaltySystem = new LoyaltySystem();